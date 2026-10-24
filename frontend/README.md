# CareCompass frontend

Vite + React + TypeScript frontend for the organiser-provided CareCompass API.
The UI calls `POST /triage` using the backend request and response schemas. It
does not implement triage rules. Emergency responses are presented with 112
guidance and caregiver matches are suppressed.

## Run locally

Requires Node.js 22.12+, 24.x, or 26+ (matching the current Vite/Vitest package engines).

```powershell
cd frontend
npm ci
npm run dev
```

The browser must grant location access because the API request includes the
user's latitude and longitude. The app sends the request to `/triage` on the
current origin by default. For local backend development, copy `.env.example`
to `.env.local` and set `VITE_API_PROXY_TARGET` to the backend origin. For a
deployed API, set `VITE_API_BASE_URL` to its origin; leave it empty when a
same-origin reverse proxy serves `/triage`.

Vite environment values are embedded at build time. Do not put secrets in
these variables. `.env.local` is ignored by Git.

## Check and test

```powershell
npm run typecheck
npm test
npm run build
```

Tests exercise the API adapter and screen flow with mocked HTTP responses.
They verify request shape, follow-up history, emergency suppression, service
failures, invalid JSON, and empty matches. They do not establish a successful
live frontend-to-backend HTTP round trip.
