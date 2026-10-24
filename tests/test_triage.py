import unittest
from datetime import datetime

from pydantic import ValidationError

from carecompass.main import app
from carecompass.matching import IST, load_caregivers
from carecompass.schemas import CareType, TriageRequest, Urgency
from carecompass.triage import decide


CAREGIVERS = load_caregivers("src/carecompass/data/caregivers.csv")
NOW = datetime(2026, 10, 24, 10, 0, tzinfo=IST)


def make_request(text: str, history: list[dict] | None = None) -> TriageRequest:
    return TriageRequest.model_validate(
        {
            "user_input": text,
            "language": "auto",
            "location": {"lat": 28.54, "lng": 77.27},
            "conversation_history": history or [],
        }
    )


class TriageRoutingTests(unittest.TestCase):
    def test_triage_route_is_registered_with_documented_contract_fields(self) -> None:
        schema = app.openapi()
        operation = schema["paths"]["/triage"]["post"]
        self.assertEqual(operation["responses"]["200"]["content"]["application/json"]["schema"]["$ref"], "#/components/schemas/TriageResponse")
        request_fields = schema["components"]["schemas"]["TriageRequest"]["required"]
        response_fields = schema["components"]["schemas"]["TriageResponse"]["required"]
        self.assertEqual(set(request_fields), {"user_input", "language", "location", "conversation_history"})
        self.assertEqual(
            set(response_fields),
            {"follow_up_question", "care_type", "urgency", "red_flags", "reasoning", "matched_caregivers"},
        )

    def test_each_documented_non_emergency_care_type_and_urgency(self) -> None:
        cases = (
            ("Doctor prescribed an injection, can someone come home", CareType.HOME_NURSING, Urgency.SAME_DAY),
            ("CBC and thyroid test with home sample collection", CareType.LAB_TEST_HOME, Urgency.SCHEDULED),
            ("Want to talk to a doctor about my reports", CareType.TELECONSULTATION, Urgency.SAME_DAY),
            ("Please check BP and sugar at home for my mother", CareType.PARAMEDIC_HOME_VISIT, Urgency.SAME_DAY),
        )
        for text, care_type, urgency in cases:
            with self.subTest(care_type=care_type):
                result = decide(make_request(text), CAREGIVERS, NOW)
                self.assertEqual(result.care_type, care_type)
                self.assertEqual(result.urgency, urgency)
                self.assertIsNone(result.follow_up_question)

    def test_insufficient_requests_ask_one_question_and_leave_decisions_null(self) -> None:
        for text in ("I need help", "doctor chahiye", "Hi, is anyone there?", "Can you assist me?"):
            with self.subTest(text=text):
                result = decide(make_request(text), CAREGIVERS, NOW)
                self.assertIsNotNone(result.follow_up_question)
                self.assertIsNone(result.care_type)
                self.assertIsNone(result.urgency)
                self.assertEqual(result.matched_caregivers, [])

    def test_clarification_questions_target_missing_route_information(self) -> None:
        cases = (
            ("doctor chahiye", "main concern ya symptom"),
            ("I need a nurse", "nursing task"),
            ("I have a fever", "home visit or a doctor consultation"),
            ("I need a test", "Which test or sample collection"),
        )
        for text, expected_question in cases:
            with self.subTest(text=text):
                result = decide(make_request(text), CAREGIVERS, NOW)
                self.assertIn(expected_question, result.follow_up_question or "")
                self.assertIsNone(result.care_type)
                self.assertIsNone(result.urgency)
                self.assertEqual(result.matched_caregivers, [])

    def test_specific_route_needs_no_irrelevant_clarification(self) -> None:
        result = decide(make_request("I have a fever and need a home visit"), CAREGIVERS, NOW)
        self.assertIsNone(result.follow_up_question)
        self.assertEqual(result.care_type, CareType.PARAMEDIC_HOME_VISIT)

    def test_clarification_uses_prior_turns_without_repeating_the_symptom_question(self) -> None:
        request = make_request(
            "I have had a fever for two days",
            [{"role": "user", "text": "doctor chahiye"}],
        )
        result = decide(request, CAREGIVERS, NOW)
        self.assertIn("home visit chahiye ya doctor consultation", result.follow_up_question or "")
        self.assertNotIn("main concern or symptom", result.follow_up_question or "")

    def test_auto_detected_language_localizes_follow_up_and_reasoning(self) -> None:
        hindi = decide(make_request("डॉक्टर चाहिए"), CAREGIVERS, NOW)
        hinglish = decide(make_request("doctor chahiye, papa ko bukhar hai"), CAREGIVERS, NOW)
        self.assertIn("डॉक्टर", hindi.follow_up_question or "")
        self.assertIn("home visit", hinglish.follow_up_question or "")

        routed = decide(make_request("घर पर जांच चाहिए"), CAREGIVERS, NOW)
        self.assertIn("आपके अनुरोध", routed.reasoning)

    def test_request_validator_preserves_nonblank_user_text_exactly(self) -> None:
        original = "  I have pain  "
        self.assertEqual(make_request(original).user_input, original)

    def test_history_red_flags_override_current_turn_intent(self) -> None:
        request = make_request(
            "Please send a nurse for an injection",
            [{"role": "user", "text": "My father is having severe chest pain"}],
        )
        result = decide(request, CAREGIVERS, NOW)
        self.assertEqual(result.care_type, CareType.EMERGENCY_112)
        self.assertEqual(result.urgency, Urgency.EMERGENCY)
        self.assertEqual(result.matched_caregivers, [])

    def test_follow_up_context_resolves_to_home_assessment(self) -> None:
        request = make_request(
            "mummy ko 2 din se bukhar hai, ghar pe dikhana hai",
            [{"role": "user", "text": "doctor chahiye"}],
        )
        result = decide(request, CAREGIVERS, NOW)
        self.assertIsNone(result.follow_up_question)
        self.assertEqual(result.care_type, CareType.PARAMEDIC_HOME_VISIT)
        self.assertEqual(result.urgency, Urgency.SAME_DAY)

    def test_required_fields_blank_text_and_invalid_coordinates_are_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            TriageRequest.model_validate({"user_input": "help"})
        with self.assertRaises(ValidationError):
            make_request("   ")
        with self.assertRaises(ValidationError):
            TriageRequest.model_validate(
                {"user_input": "help", "language": "auto", "location": {"lat": 91, "lng": 0}, "conversation_history": []}
            )
