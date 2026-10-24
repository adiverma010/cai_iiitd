import unittest

from carecompass.main import app


class HealthEndpointTests(unittest.TestCase):
    def test_health_returns_ok(self) -> None:
        route = next(route for route in app.routes if getattr(route, "path", None) == "/health")

        self.assertEqual(route.methods, {"GET"})
        self.assertEqual(route.endpoint(), {"status": "ok"})


if __name__ == "__main__":
    unittest.main()
