"""Reproducible, exploratory evaluation against the supplied synthetic examples."""

import argparse
import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from .matching import IST, load_caregivers
from .schemas import TriageRequest
from .triage import decide


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATASET = ROOT / "tests" / "fixtures" / "triage_dataset.jsonl"
DEFAULT_CAREGIVERS = Path(__file__).resolve().parent / "data" / "caregivers.csv"


def _label(value: str | None) -> str:
    return value if value is not None else "follow_up"


def _macro_f1(truth: list[str], predicted: list[str]) -> float:
    labels = sorted(set(truth) | set(predicted))
    values = []
    for label in labels:
        tp = sum(actual == label and guess == label for actual, guess in zip(truth, predicted))
        fp = sum(actual != label and guess == label for actual, guess in zip(truth, predicted))
        fn = sum(actual == label and guess != label for actual, guess in zip(truth, predicted))
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        values.append(2 * precision * recall / (precision + recall) if precision + recall else 0.0)
    return sum(values) / len(values) if values else 0.0


def _binary_metrics(truth: list[bool], predicted: list[bool]) -> tuple[float, float, float]:
    tp = sum(a and p for a, p in zip(truth, predicted))
    fp = sum(not a and p for a, p in zip(truth, predicted))
    fn = sum(a and not p for a, p in zip(truth, predicted))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return precision, recall, f1


def _normalise_query(text: str) -> str:
    return " ".join(text.casefold().split())


def evaluate(dataset_path: Path, caregivers_path: Path, at_time: str) -> dict[str, float | int]:
    examples = [
        json.loads(line)
        for line in dataset_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    caregivers = load_caregivers(caregivers_path)

    grouped: dict[str, list[dict]] = defaultdict(list)
    for example in examples:
        grouped[_normalise_query(example["request"]["user_input"])].append(example)
    inconsistent = 0
    for group in grouped.values():
        class_labels = {
            (item["response"]["care_type"], item["response"]["urgency"])
            for item in group
        }
        if len(class_labels) != 1:
            inconsistent += 1
    if inconsistent:
        raise ValueError(f"{inconsistent} duplicate-query groups have inconsistent triage labels")

    # This hand-written rule baseline has no fitted model. Score each exact
    # normalized query once so repeated rows do not inflate text-label metrics.
    group_items = sorted(grouped.items())
    gold_care: list[str] = []
    pred_care: list[str] = []
    gold_urgency: list[str] = []
    pred_urgency: list[str] = []
    structured_exact = 0
    follow_gold: list[bool] = []
    follow_pred: list[bool] = []
    emergency_gold: list[bool] = []
    emergency_pred: list[bool] = []
    for _, group in group_items:
        example = group[0]
        request = TriageRequest.model_validate(example["request"])
        predicted = decide(request, caregivers)
        expected = example["response"]
        care_truth, care_guess = _label(expected["care_type"]), _label(
            predicted.care_type.value if predicted.care_type else None
        )
        urgency_truth, urgency_guess = _label(expected["urgency"]), _label(
            predicted.urgency.value if predicted.urgency else None
        )
        gold_care.append(care_truth)
        pred_care.append(care_guess)
        gold_urgency.append(urgency_truth)
        pred_urgency.append(urgency_guess)
        follow_gold.append(expected["care_type"] is None)
        follow_pred.append(predicted.follow_up_question is not None)
        emergency_gold.append(expected["care_type"] == "emergency_112")
        emergency_pred.append(predicted.care_type is not None and predicted.care_type.value == "emergency_112")
        if (
            care_truth == care_guess
            and urgency_truth == urgency_guess
            and set(expected["red_flags"]) == {flag.value for flag in predicted.red_flags}
            and (expected["follow_up_question"] is not None) == (predicted.follow_up_question is not None)
        ):
            structured_exact += 1

    # Matching labels vary by row (including request location), so score them
    # row by row at an explicit, fixed time instead of grouping by text.
    hour, minute = (int(part) for part in at_time.split(":"))
    fixed_now = datetime(2026, 10, 24, hour, minute, tzinfo=IST)
    match_hits = match_predicted = match_reference = eligible_match_rows = 0
    match_row_hits = 0
    for example in examples:
        request = TriageRequest.model_validate(example["request"])
        predicted = decide(request, caregivers, now=fixed_now)
        predicted_ids = {match.caregiver_id for match in predicted.matched_caregivers}
        reference_ids = {match["caregiver_id"] for match in example["response"]["matched_caregivers"]}
        if reference_ids:
            eligible_match_rows += 1
            if predicted_ids.intersection(reference_ids):
                match_row_hits += 1
        match_hits += len(predicted_ids.intersection(reference_ids))
        match_predicted += len(predicted_ids)
        match_reference += len(reference_ids)

    follow_p, follow_r, follow_f1 = _binary_metrics(follow_gold, follow_pred)
    _, emergency_recall, _ = _binary_metrics(emergency_gold, emergency_pred)
    return {
        "source_rows_validated": len(examples),
        "unique_query_groups_scored": len(grouped),
        "care_urgency_exact_match": sum(
            a == b and c == d
            for a, b, c, d in zip(gold_care, pred_care, gold_urgency, pred_urgency)
        ) / len(group_items),
        "structured_decision_exact_match": structured_exact / len(group_items),
        "care_type_macro_f1": _macro_f1(gold_care, pred_care),
        "urgency_macro_f1": _macro_f1(gold_urgency, pred_urgency),
        "emergency_recall": emergency_recall,
        "follow_up_precision": follow_p,
        "follow_up_recall": follow_r,
        "follow_up_f1": follow_f1,
        "caregiver_precision_at_3": match_hits / match_predicted if match_predicted else 0.0,
        "caregiver_recall_at_3": match_hits / match_reference if match_reference else 0.0,
        "caregiver_hit_rate_at_3": match_row_hits / eligible_match_rows if eligible_match_rows else 0.0,
        "caregiver_rows_with_reference_matches": eligible_match_rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--caregivers", type=Path, default=DEFAULT_CAREGIVERS)
    parser.add_argument("--at", default="10:00", help="Fixed local availability time in HH:MM IST")
    args = parser.parse_args()
    print(json.dumps(evaluate(args.dataset, args.caregivers, args.at), indent=2))
    print("Exploratory synthetic-label comparison only; not clinical validation.")
    print("Caregiver metrics use a fixed availability time; source rows contain no request timestamp.")
    print("Emergency recall is measured against synthetic emergency_112 care_type labels.")


if __name__ == "__main__":
    main()
