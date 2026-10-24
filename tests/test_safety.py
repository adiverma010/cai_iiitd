import unittest
from datetime import datetime

from carecompass.matching import IST, load_caregivers
from carecompass.safety import detect_red_flags
from carecompass.schemas import CareType, Location, TriageRequest, Urgency
from carecompass.triage import decide


CAREGIVERS = load_caregivers("src/carecompass/data/caregivers.csv")
NOW = datetime(2026, 10, 24, 10, 0, tzinfo=IST)


class RedFlagTests(unittest.TestCase):
    def test_all_nine_documented_categories_have_independent_examples(self) -> None:
        examples = {
            "chest_pain": "My father has severe chest pain",
            "breathlessness": "I am having trouble breathing",
            "unconsciousness": "He suddenly collapsed and is not responding",
            "severe_bleeding": "Heavy bleeding that will not stop after an accident",
            "stroke_symptoms": "Her face is drooping and she has slurred speech",
            "seizure": "He is having a seizure",
            "high_fever_infant": "Our newborn has a very high fever",
            "suicidal_ideation": "I want to end my life",
            "severe_dehydration": "The patient has severe dehydration",
        }
        for expected, text in examples.items():
            with self.subTest(flag=expected):
                self.assertEqual([flag.value for flag in detect_red_flags(text)], [expected])

    def test_every_red_flag_category_overrides_to_emergency_without_matches(self) -> None:
        examples = (
            "My father has severe chest pain",
            "I am having trouble breathing",
            "He suddenly collapsed and is not responding",
            "Heavy bleeding that will not stop after an accident",
            "Her face is drooping and she has slurred speech",
            "He is having a seizure",
            "Our newborn has a very high fever",
            "I want to end my life",
            "The patient has severe dehydration",
        )
        for text in examples:
            with self.subTest(text=text):
                result = decide(self.request(text), CAREGIVERS, NOW)
                self.assertEqual(result.care_type, CareType.EMERGENCY_112)
                self.assertEqual(result.urgency, Urgency.EMERGENCY)
                self.assertTrue(result.red_flags)
                self.assertEqual(result.matched_caregivers, [])
                self.assertIn("112", result.reasoning)

    def test_source_examples_route_to_emergency_before_matching(self) -> None:
        for text, expected_flag in (
            ("accident ke baad bleeding ruk nahi rahi", "severe_bleeding"),
            ("wo achanak gir gaye response nahi de rahe", "unconsciousness"),
            ("papa ko severe chest pain hai saans nahi aa rahi", "chest_pain"),
        ):
            with self.subTest(text=text):
                result = decide(self.request(text), CAREGIVERS, NOW)
                self.assertEqual(result.care_type, CareType.EMERGENCY_112)
                self.assertEqual(result.urgency, Urgency.EMERGENCY)
                self.assertIn(expected_flag, [flag.value for flag in result.red_flags])
                self.assertEqual(result.matched_caregivers, [])
                self.assertIn("112", result.reasoning)

    def test_negated_chest_pain_does_not_match_chest_pain_category(self) -> None:
        self.assertNotIn("chest_pain", [flag.value for flag in detect_red_flags("No chest pain today")])

    @staticmethod
    def request(text: str) -> TriageRequest:
        return TriageRequest.model_validate(
            {
                "user_input": text,
                "language": "auto",
                "location": {"lat": 28.54, "lng": 77.27},
                "conversation_history": [],
            }
        )
