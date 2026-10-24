import unittest
from unittest.mock import MagicMock, patch

from carecompass.providers import (
    ProviderRecord,
    discover_providers,
    is_valid_url,
)


class ProviderDiscoveryTests(unittest.TestCase):
    def test_emergency_care_type_suppresses_provider_discovery(self) -> None:
        resp = discover_providers("emergency_112")
        self.assertEqual(resp.status, "suppressed_emergency")
        self.assertEqual(resp.providers, [])
        self.assertIn("112", resp.message)

    def test_unconfigured_tinyfish_returns_grounded_fallback(self) -> None:
        with patch.dict("os.environ", {}, clear=True):
            resp = discover_providers("home_nursing", "Delhi NCR")
            self.assertEqual(resp.status, "demo_grounded")
            self.assertTrue(len(resp.providers) > 0)
            first = resp.providers[0]
            self.assertEqual(first.care_type, "home_nursing")
            self.assertEqual(first.availability, "unknown")
            self.assertEqual(first.verification_status, "partial")
            self.assertTrue(is_valid_url(first.official_url))

    def test_valid_url_check(self) -> None:
        self.assertTrue(is_valid_url("https://www.apollohomecare.com"))
        self.assertTrue(is_valid_url("http://localhost:8000"))
        self.assertFalse(is_valid_url("not-a-url"))
        self.assertFalse(is_valid_url(""))
        self.assertFalse(is_valid_url("javascript:alert(1)"))

    def test_mocked_tinyfish_search_response(self) -> None:
        mock_payload = {
            "results": [
                {
                    "title": "Delhi Home Nursing Services",
                    "url": "https://example.com/delhi-nursing",
                }
            ]
        }
        mock_resp = MagicMock()
        mock_resp.read.return_value = str(mock_payload).replace("'", '"').encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp

        with patch("urllib.request.urlopen", return_value=mock_resp):
            resp = discover_providers("home_nursing", api_key_override="mock_test_key")
            self.assertEqual(resp.status, "live_verified")
            self.assertEqual(len(resp.providers), 1)
            self.assertEqual(resp.providers[0].provider_name, "Delhi Home Nursing Services")
            self.assertEqual(resp.providers[0].verification_status, "verified")
            self.assertEqual(resp.providers[0].availability, "unknown")
