# CareCompass API

Minimal backend foundation for the CareCompass hackathon project.

## Run locally

```powershell
python -m pip install -e .
uvicorn carecompass.main:app --app-dir src --reload
```

The health endpoint is available at `GET /health` and returns `{"status":"ok"}`.

## Run tests

```powershell
$env:PYTHONPATH = "src"
python -m unittest discover -s tests -v
```

The health test verifies that `/health` is registered as a `GET` route and
that its handler returns the expected payload. It does not exercise the full
ASGI response path. In restricted environments, in-process ASGI test
transports may stall, and directly serving the application may be blocked by
local socket permissions.
