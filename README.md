# CareCompass API

Minimal backend foundation for the CareCompass hackathon project.

## Run locally

```powershell
python -m pip install -e .
uvicorn carecompass.main:app --app-dir src --reload
```

The health endpoint is available at `GET /health` and returns `{"status":"ok"}`.

## Run the health test

```powershell
$env:PYTHONPATH = "src"
python -m unittest discover -s tests -v
```
