# CareCompass frontend integration prototype

Vite + React + TypeScript frontend connected to the confirmed CareCompass `/triage` API contract. The backend uses deterministic prototype rules and a synthetic caregiver roster. It is not clinically validated and must not be treated as medical advice or a dependable emergency assessment. A backend emergency response advises calling 112 and never displays caregiver matches.

## Run locally

Requires Node.js 20.19+ or 22.12+ and Python 3.11+.

Start the backend from the repository root:

```powershell
python -m pip install -e .
uvicorn carecompass.main:app --app-dir src --reload
```

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

The frontend defaults to `/api`; Vite proxies it to `http://127.0.0.1:8000`. Copy `.env.example` to `.env.local` to configure `VITE_API_BASE_URL` or `CARECOMPASS_API_PROXY_TARGET`. Production deployments should set `VITE_API_BASE_URL` to their reachable API base URL. The required coordinates are supplied by the user; the frontend does not invent a location.

The UI sends the symptom description and selected language to the backend. Synthetic caregiver results show only backend IDs, scores, and reasons, and remain explicitly labelled. The HTTP adapter validates responses and rejects malformed or inconsistent emergency/clarification results. `CareService` in `src/services/careTypes.ts` is the typed integration boundary; `apiCareService.ts` implements it against the current backend schemas.

## Check and test

```powershell
npm run typecheck
npm run build
npm test
```

Backend tests, from the repository root:

```powershell
$env:PYTHONPATH = "src"
python -m unittest discover -s tests -v
```
