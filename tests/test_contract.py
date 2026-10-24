import csv
import json
import unittest
from pathlib import Path

from carecompass.schemas import TriageRequest, TriageResponse


FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures"


class DatasetContractTests(unittest.TestCase):
    def test_all_340_examples_match_request_and_response_models(self) -> None:
        roster_path = Path(__file__).resolve().parents[1] / "src" / "carecompass" / "data" / "caregivers.csv"
        with roster_path.open(encoding="utf-8-sig", newline="") as source:
            caregiver_ids = {row["caregiver_id"] for row in csv.DictReader(source)}

        lines = (FIXTURE_DIR / "triage_dataset.jsonl").read_text(encoding="utf-8").splitlines()
        self.assertEqual(len(lines), 340)
        for line_number, line in enumerate(lines, start=1):
            with self.subTest(line=line_number):
                example = json.loads(line)
                TriageRequest.model_validate(example["request"])
                response = TriageResponse.model_validate(example["response"])
                self.assertTrue(
                    all(match.caregiver_id in caregiver_ids for match in response.matched_caregivers)
                )

    def test_multi_turn_fixture_contains_both_documented_flows(self) -> None:
        lines = (FIXTURE_DIR / "multi_turn_examples.jsonl").read_text(encoding="utf-8").splitlines()
        examples = [json.loads(line) for line in lines if line.strip()]
        self.assertEqual(len(examples), 2)
        self.assertTrue(any(turn.get("follow_up_question") for turn in examples[0]["turns"]))
        self.assertTrue(any(turn.get("care_type") == "emergency_112" for turn in examples[1]["turns"]))
