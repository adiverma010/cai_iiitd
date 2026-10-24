import type {
  CareService,
  CareType,
  Location,
  RedFlag,
  TriageRequest,
  TriageResponse,
  Urgency,
} from "./careTypes";

const careTypes = new Set<CareType>([
  "paramedic_home_visit",
  "home_nursing",
  "lab_test_home",
  "teleconsultation",
  "emergency_112",
]);
const urgencies = new Set<Urgency>(["emergency", "same_day", "scheduled"]);
const redFlags = new Set<RedFlag>([
  "chest_pain",
  "breathlessness",
  "unconsciousness",
  "severe_bleeding",
  "stroke_symptoms",
  "seizure",
  "high_fever_infant",
  "suicidal_ideation",
  "severe_dehydration",
]);

export type CareApiErrorKind = "network" | "http" | "invalid-json" | "invalid-response";

export class CareApiError extends Error {
  constructor(readonly kind: CareApiErrorKind, readonly status?: number) {
    super(kind === "http" ? `Care service returned HTTP ${status}` : `Care service error: ${kind}`);
    this.name = "CareApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTriageResponse(value: unknown): value is TriageResponse {
  if (!isRecord(value)) return false;
  if (value.follow_up_question !== null && typeof value.follow_up_question !== "string") return false;
  if (value.care_type !== null && !careTypes.has(value.care_type as CareType)) return false;
  if (value.urgency !== null && !urgencies.has(value.urgency as Urgency)) return false;
  if (!Array.isArray(value.red_flags) || !value.red_flags.every((flag) => redFlags.has(flag as RedFlag))) return false;
  if (typeof value.reasoning !== "string" || !Array.isArray(value.matched_caregivers)) return false;
  if (value.matched_caregivers.length > 3) return false;

  const matchesAreValid = value.matched_caregivers.every((match: unknown) => {
    if (!isRecord(match)) return false;
    return (
      typeof match.caregiver_id === "string" &&
      typeof match.score === "number" &&
      Number.isFinite(match.score) &&
      match.score >= 0 &&
      match.score <= 1 &&
      typeof match.reason === "string"
    );
  });
  if (!matchesAreValid) return false;

  if (value.follow_up_question !== null) {
    if (!value.follow_up_question.trim() || value.care_type !== null || value.urgency !== null) return false;
    if (value.matched_caregivers.length > 0) return false;
  } else if (value.care_type === null || value.urgency === null) {
    return false;
  }
  return true;
}

function emergencyResponse(value: Record<string, unknown>): TriageResponse {
  const flags = Array.isArray(value.red_flags)
    ? value.red_flags.filter((flag): flag is RedFlag => typeof flag === "string" && redFlags.has(flag as RedFlag))
    : [];
  return {
    follow_up_question: null,
    care_type: "emergency_112",
    urgency: "emergency",
    red_flags: flags,
    reasoning:
      typeof value.reasoning === "string" && value.reasoning.trim()
        ? value.reasoning
        : "Potential emergency signs detected. Call 112 now.",
    matched_caregivers: [],
  };
}

function isEmergencySignal(value: Record<string, unknown>): boolean {
  return (
    (Array.isArray(value.red_flags) && value.red_flags.length > 0) ||
    value.care_type === "emergency_112" ||
    value.urgency === "emergency"
  );
}

function apiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
}

export async function submitTriage(
  request: TriageRequest,
  fetcher: typeof fetch = fetch,
  baseUrl = apiBaseUrl(),
): Promise<TriageResponse> {
  let response: Response;
  try {
    response = await fetcher(`${baseUrl}/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new CareApiError("network");
  }

  // Do not parse non-2xx bodies: the organiser has not specified an error-body contract.
  if (!response.ok) throw new CareApiError("http", response.status);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new CareApiError("invalid-json");
  }

  if (!isRecord(body)) throw new CareApiError("invalid-response");
  // Fail closed if the server signals an emergency, even if other response fields
  // are malformed or caregiver matches were accidentally included.
  if (isEmergencySignal(body)) return emergencyResponse(body);
  if (!isTriageResponse(body)) throw new CareApiError("invalid-response");
  return body;
}

export async function discoverProviders(
  careType: string,
  locationLabel = "Delhi NCR",
  fetcher: typeof fetch = fetch,
  baseUrl = apiBaseUrl(),
): Promise<import("./careTypes").DiscoveryResponse> {
  if (careType === "emergency_112") {
    return {
      status: "suppressed_emergency",
      care_type: careType,
      providers: [],
      message: "Emergency care routes bypass provider discovery. Call 112.",
      checked_at: new Date().toISOString(),
    };
  }
  try {
    const res = await fetcher(`${baseUrl}/providers/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ care_type: careType, location_label: locationLabel }),
    });
    if (!res.ok) throw new Error("HTTP error");
    return (await res.json()) as import("./careTypes").DiscoveryResponse;
  } catch {
    return {
      status: "empty",
      care_type: careType,
      providers: [],
      message: "Provider discovery is currently offline or unreachable.",
      checked_at: new Date().toISOString(),
    };
  }
}

export const apiCareService: CareService = {
  submit: (request) => submitTriage(request),
  discoverProviders: (careType, locationLabel) => discoverProviders(careType, locationLabel),
};

export function getBrowserLocation(): Promise<Location> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("location-unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
      () => reject(new Error("location-unavailable")),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 60_000 },
    );
  });
}
