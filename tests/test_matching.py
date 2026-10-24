import unittest
from datetime import datetime

from carecompass.matching import IST, load_caregivers, match_caregivers
from carecompass.schemas import CareType, Location


ROSTER = load_caregivers("src/carecompass/data/caregivers.csv")
NOW = datetime(2026, 10, 24, 10, 0, tzinfo=IST)


class CaregiverMatchingTests(unittest.TestCase):
    def test_injection_match_respects_role_skill_language_active_time_and_radius(self) -> None:
        location = Location(lat=28.4704, lng=77.5004)
        matches = match_caregivers(CareType.HOME_NURSING, "injection at home", "English", location, ROSTER, NOW)
        self.assertTrue(matches)
        caregivers = {caregiver.caregiver_id: caregiver for caregiver in ROSTER}
        for match in matches:
            caregiver = caregivers[match["caregiver_id"]]
            self.assertEqual(caregiver.role, "medic")
            self.assertIn(caregiver.qualification, {"GNM Nursing", "B.Sc Nursing"})
            self.assertTrue(caregiver.active)
            self.assertTrue(caregiver.skills.intersection({"injection_im", "injection_iv"}))
            self.assertIn("English", caregiver.languages)
            self.assertGreaterEqual(match["score"], 0)
            self.assertLessEqual(match["score"], 1)

    def test_physical_match_respects_radius_and_time_availability(self) -> None:
        matches = match_caregivers(
            CareType.LAB_TEST_HOME,
            "blood test home collection",
            "English",
            Location(lat=0, lng=0),
            ROSTER,
            NOW,
        )
        self.assertEqual(matches, [])

    def test_teleconsultation_ignores_distance_but_checks_role_language_and_availability(self) -> None:
        far_matches = match_caregivers(
            CareType.TELECONSULTATION,
            "talk to a doctor about reports",
            "Hindi",
            Location(lat=0, lng=0),
            ROSTER,
            NOW,
        )
        near_matches = match_caregivers(
            CareType.TELECONSULTATION,
            "talk to a doctor about reports",
            "Hindi",
            Location(lat=28.46, lng=77.51),
            ROSTER,
            NOW,
        )
        self.assertTrue(far_matches)
        self.assertEqual(far_matches, near_matches)
        caregivers = {caregiver.caregiver_id: caregiver for caregiver in ROSTER}
        self.assertTrue(all(caregivers[item["caregiver_id"]].role == "doctor" for item in far_matches))
        self.assertTrue(all(0 <= item["score"] <= 1 for item in far_matches))

    def test_emergency_never_returns_matches(self) -> None:
        self.assertEqual(
            match_caregivers(
                CareType.EMERGENCY_112,
                "chest pain",
                "English",
                Location(lat=28.54, lng=77.27),
                ROSTER,
                NOW,
            ),
            [],
        )

    def test_hinglish_match_requires_both_hindi_and_english(self) -> None:
        matches = match_caregivers(
            CareType.HOME_NURSING,
            "injection ghar pe chahiye",
            "Hinglish",
            Location(lat=28.4704, lng=77.5004),
            ROSTER,
            NOW,
        )
        self.assertTrue(matches)
        caregivers = {caregiver.caregiver_id: caregiver for caregiver in ROSTER}
        self.assertTrue(
            all({"Hindi", "English"}.issubset(caregivers[item["caregiver_id"]].languages) for item in matches)
        )
