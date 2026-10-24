# CareCompass frontend prototype

This Vite + React + TypeScript app is a frontend-only demonstration. The intake is not sent to a backend, descriptions are not classified, and every response/profile is mock content. The emergency-screen example appears only when selected from the demo control; it is not a clinical assessment or an escalation decision.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```powershell
cd frontend
npm install
npm run dev
```

## Check and test

```powershell
npm run typecheck
npm run build
npm test
```

The `CareService` interface in `src/services/careTypes.ts` is the replaceable UI boundary. `mockCareService.ts` and `mockCareData.ts` contain development-only scenarios and placeholder profiles. Replace this adapter only after Aditya approves the real API contract; the demo response types are not that contract.
