from pathlib import Path

from fastapi import FastAPI
from pydantic import BaseModel

from .matching import load_caregivers
from .providers import DiscoveryResponse, discover_providers
from .schemas import TriageRequest, TriageResponse
from .triage import decide

app = FastAPI(title="CareCompass API")
_CAREGIVER_FILE = Path(__file__).resolve().parent / "data" / "caregivers.csv"
_CAREGIVERS = load_caregivers(_CAREGIVER_FILE)


class ProviderDiscoveryRequest(BaseModel):
    care_type: str
    location_label: str = "Delhi NCR"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/triage", response_model=TriageResponse)
def triage(request: TriageRequest) -> TriageResponse:
    return decide(request, _CAREGIVERS)


@app.post("/providers/discover", response_model=DiscoveryResponse)
def discover(req: ProviderDiscoveryRequest) -> DiscoveryResponse:
    return discover_providers(req.care_type, req.location_label)
