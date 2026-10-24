# CareCompass — Multilingual, Safety-First Care Navigation

CareCompass is a safety-first, explainable healthcare navigation assistant designed for Indian multilingual contexts (English, Hindi, and Hinglish). It helps patients navigate non-emergency home care, nursing, physical therapy, and teleconsultations while strictly prioritizing emergency triage and suppressing ordinary care recommendations when acute red flags are detected.

> **Medical Disclaimer & Prototype Notice**: CareCompass is an engineering prototype and care-navigation assistant, **not** a diagnostic medical device or a substitute for professional clinical judgment. It does not provide medical diagnoses, prescribe medications, or confirm live hospital admissions. In life-threatening emergencies, users must immediately call **112** or proceed to the nearest emergency department.

---

## System Architecture & Security Boundary

```
+-------------------------------------------------------------+
|                 Frontend (React + Vite + TS)                |
|  - Accessible Typography & Mobile-First Touch Targets       |
|  - English / Hindi / Hinglish Dynamic Copy                  |
|  - Context-Preserving Follow-up Intake                      |
|  - Web Speech API Voice Dictation with Fallback             |
|  - Outbound Action Dispatch (tel:, maps, synthetic booking)  |
|  - Clinician Consultation Handoff & Local Reminders         |
+------------------------------+------------------------------+
                               |
                   Vite Reverse Proxy (/triage, /providers)
                               |
                               v
+-------------------------------------------------------------+
|                 Backend (FastAPI + Python 3.14)             |
|  - Deterministic Safety-First Red Flag Engine (9 Red Flags) |
|  - Concern-Aware Clarification Routing                      |
|  - Explainable Multilingual Caregiver Matching              |
|  - TinyFish Live Provider Discovery & Fallback Boundary     |
+-------------------------------------------------------------+
```

- **Security Boundary**: The browser client communicates with the FastAPI backend via Vite proxy or direct CORS-validated requests. External third-party credentials (such as TinyFish API keys) are strictly contained on the server side and never exposed to client bundles.

---

## Quick Start & Local Execution

### 1. Prerequisites
- Python 3.10+ (tested on Python 3.14 on Windows 64-bit)
- Node.js 18+ and npm

### 2. Backend Setup
From the repository root in PowerShell:
```powershell
# Set Python path to include 'src'
$env:PYTHONPATH = "src"

# Run FastAPI server on port 8000
python -m uvicorn carecompass.main:app --host 127.0.0.1 --port 8000
```
- Health Check: `GET http://127.0.0.1:8000/health` returns `{"status":"ok"}`
- Triage Endpoint: `POST http://127.0.0.1:8000/triage`
- Provider Discovery Endpoint: `POST http://127.0.0.1:8000/providers/discover`

### 3. Frontend Setup
From the `frontend` directory in PowerShell:
```powershell
cd frontend
npm install
npm run dev
```
- The Vite development server runs at `http://localhost:5173`.
- Reverse proxy configuration in `vite.config.ts` automatically forwards `/triage` and `/providers` to `http://127.0.0.1:8000`.

---

## Verification & Test Commands

### Backend Test Suite
Executes 30 automated unit tests covering safety rules, emergency suppression, triage routing, multilingual matching, and provider discovery:
```powershell
$env:PYTHONPATH = "src"
python -m unittest discover -s tests -v
```

### Benchmark Evaluation
Evaluates deterministic triage routing and emergency recall against normalized benchmark query groups at reference time `10:00 IST`:
```powershell
$env:PYTHONPATH = "src"
python -m carecompass.evaluation --at 10:00
```
- **Results**: 100% Emergency Recall (56/56 red-flag queries detected), 92.3% Care/Urgency Exact Match across 65 benchmark query groups.

### Frontend Test Suite & Typecheck
From the `frontend` folder:
```powershell
# Typecheck
npm run typecheck

# Unit & Component Tests (Vitest)
npm test

# Production Build
npm run build
```
- **Results**: 13 passing unit and component tests across `App.test.tsx` and `languageDetection.test.ts`. Production bundle built cleanly with zero TypeScript errors.

---

## Core Product Capabilities

### 1. Safety-First Red Flag Detection & Emergency Suppression
- Evaluates 9 critical red flags before any caregiver matching:
  - `chest_pain`, `breathlessness`, `unconsciousness`, `severe_bleeding`, `stroke_symptoms`, `seizure`, `high_fever_infant`, `suicidal_ideation`, `severe_dehydration`.
- Handles Hindi/Hinglish colloquialisms (e.g., *"saans phool rahi hai"*, *"khoon ki ulti"*, *"stroke hua"*), numerical pediatric fever thresholds (e.g., *"103 F fever for 3 month old"*), and protective false-positive filters (*"fit and fine"*, *"past history of stroke 5 years ago"*).
- **Strict Suppression**: When an emergency is triggered, ordinary caregiver rosters and external provider search results are completely suppressed. The user is presented with immediate emergency guidance and a direct call action (`tel:112`).

### 2. Concern-Aware Clarification & Context Preservation
- When initial input lacks sufficient detail for clinical routing, the system generates targeted follow-up questions tailored to the category of concern (e.g., fever duration/temperature vs. mobility pain) rather than generic prompts.
- User input is preserved across clarification rounds so previous answers are never lost or duplicated.

### 3. Multilingual Support
- Automatic language detection supports English, Hindi, and Hinglish.
- Content responses and explanations are dynamically localized, maintaining clarity for bilingual patients and families.

### 4. Explainable Matching & Actionable Next Steps
- For non-emergency needs (home nursing, physiotherapy, vitals monitoring, teleconsultations), caregivers from the verified roster are ranked using distance, qualifications, language compatibility, and availability.
- Transparent match reasons explain why each caregiver was suggested.
- Outbound actions allow calling (`tel:`), getting transit directions (`maps.google.com`), or creating a simulated demo booking (`DEMO-REQ-XXXX`) with clear synthetic demarcation.

### 5. TinyFish Web Discovery Integration
- Non-emergency cases can optionally trigger live web discovery via `POST /providers/discover` to find local clinics, diagnostics, and hospitals.
- Full provenance details (source URL, search term, retrieval timestamp) and clear disclaimers accompany all external findings.
- If unconfigured or offline, the system safely falls back to grounded reference facilities.

### 6. Consultation Handoff & Patient Tools
- **Consultation Preparation**: Generates an editable clinical handoff note summarizing symptoms, timeline, red flags, and care type with a one-click copy button.
- **Local Reminders**: Allows users to schedule local browser-stored follow-up reminders with explicit consent checkboxes.
- **Voice Accessibility**: Speech-to-text dictation with automatic graceful fallback notices on unsupported browsers.

---

## Synthetic Data Caveats & Ground Truth Notes

- **Synthetic Roster**: All caregiver profiles, names, ratings, and phone numbers are synthetic hackathon test fixtures. They do not represent real-world medical staff or live booking availability.
- **Benchmark Labels**: Source benchmark datasets include known synthetic label quirks (such as dual labeling of `chest_pain` and `breathlessness` across all emergency samples). CareCompass enforces a clean, deterministic 9-flag clinical taxonomy at runtime rather than relying on noisy dataset labels.
- **Time Windowing**: Caregiver matching respects availability windows (`Asia/Kolkata`). Evaluation benchmark runs specify explicit test times (`--at 10:00`) to guarantee deterministic scoring.
