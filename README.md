# CareCompass API

Minimal, deterministic backend prototype for the supplied synthetic Sanocare
hackathon contract. It is not a medical device, medical advice, or clinical
validation.

## Run locally

```powershell
python -m pip install -e .
uvicorn carecompass.main:app --app-dir src --reload
```

`GET /health` returns `{"status":"ok"}`. `POST /triage` accepts:

```json
{
  "user_input": "papa ko do din se bukhar hai aur khansi bhi",
  "language": "auto",
  "location": {"lat": 28.54, "lng": 77.27},
  "conversation_history": []
}
```

The response follows the supplied fields and enums: `follow_up_question`,
`care_type`, `urgency`, `red_flags`, `reasoning`, and `matched_caregivers`.
Malformed or missing request fields receive FastAPI's standard 422 validation
response. Conversation-history objects are accepted as provided; user turns
with `role: "user"` and a `text` or `user_input` field are included as context.

## Tests and evaluation

```powershell
$env:PYTHONPATH = "src"
python -m unittest discover -s tests -v
python -m carecompass.evaluation --at 10:00
```

Tests verify route registration and exercise the routing/validation functions
directly. In this environment, both an in-process ASGI request and direct
`uvicorn` serving stalled or were blocked, so an HTTP response round trip is
not currently verified. No local network socket is needed for the unit tests.

The evaluation compares the deterministic rules with one representative per
normalized query (65 groups), so repeated text does not inflate text-label
metrics. Caregiver ranking is evaluated row by row at the explicit fixed time
`10:00 IST`; the labelled requests contain no request timestamp, so matching
metrics are exploratory. No model is trained, and this is not a held-out or
clinical-validity result.

## Routing and safety behaviour

- Red-flag phrase rules run before service routing and caregiver matching. A
  detected flag returns `emergency_112`, `emergency`, no caregiver matches,
  and guidance to call 112.
- The nine flags are the supplied taxonomy: `chest_pain`, `breathlessness`,
  `unconsciousness`, `severe_bleeding`, `stroke_symptoms`, `seizure`,
  `high_fever_infant`, `suicidal_ideation`, and `severe_dehydration`.
- Phrase checks are deterministic English/Hindi/Hinglish heuristics. They are
  not clinically validated and can miss paraphrases or raise false alarms.
- Insufficient or unrecognized requests receive one follow-up question with
  null `care_type` and `urgency`. Ordinary service routing uses transparent
  intent phrases; labs map to `scheduled`, other non-emergency services to
  `same_day`, matching the supplied examples. This is a prototype policy, not
  a clinical urgency assessment.

## Caregiver matching decisions

- The matcher filters inactive caregivers, role/qualification mismatches,
  missing relevant skills, language mismatch, out-of-radius providers, and
  providers outside their current availability window in `Asia/Kolkata`.
- Hinglish is considered a match when the caregiver speaks both Hindi and
  English. Teleconsultation ignores distance and renormalizes the other score
  weights to sum to one. Physical proximity score is `max(0, 1 - distance /
  service_radius)`. Ties break by caregiver ID.
- Home nursing maps requested procedures to roster skills; home assessments
  require `vitals_monitoring` or `bp_sugar_check`; lab collection requires
  `sample_collection` or `home_phlebotomy`; teleconsultation requires the
  corresponding roster skill. The output is limited to the top three matches.
- `/triage` is the implementation route because the supplied README defined
  the payload but did not name an HTTP path.

## Supplied data caveats

The included source data is synthetic and expressly permitted for hackathon
redistribution by its supplied README. The flat CSV is omitted because it
duplicates the JSONL fixture. The source labels are not clinical ground truth.
There is a specific red-flag inconsistency: all 56 emergency examples label
both `chest_pain` and `breathlessness`, including examples describing bleeding
or an unresponsive person. The runtime safety layer therefore uses the
documented taxonomy and phrase rules, not those source flag labels.
