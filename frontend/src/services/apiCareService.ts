import type { CareService, TriageRequest, TriageResponse } from "./careTypes";

const careTypes = new Set(["paramedic_home_visit", "home_nursing", "lab_test_home", "teleconsultation", "emergency_112"]);
const urgencies = new Set(["emergency", "same_day", "scheduled"]);
const redFlags = new Set([
  "chest_pain", "breathlessness", "unconsciousness", "severe_bleeding", "stroke_symptoms",
  "seizure", "high_fever_infant", "suicidal_ideation", "severe_dehydration",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate untrusted JSON against the checked-in backend contract before the UI uses it. */
export function parseTriageResponse(value: unknown): TriageResponse {
  if (!isRecord(value)) throw new Error("The triage service returned an invalid response.");
  const { follow_up_question, care_type, urgency, red_flags, reasoning, matched_caregivers } = value;
  if (follow_up_question !== null && typeof follow_up_question !== "string") throw new Error("The triage service returned an invalid response.");
  if (care_type !== null && (typeof care_type !== "string" || !careTypes.has(care_type))) throw new Error("The triage service returned an invalid response.");
  if (urgency !== null && (typeof urgency !== "string" || !urgencies.has(urgency))) throw new Error("The triage service returned an invalid response.");
  if (!Array.isArray(red_flags) || !red_flags.every((flag) => typeof flag === "string" && redFlags.has(flag))) throw new Error("The triage service returned an invalid response.");
  if (typeof reasoning !== "string" || !Array.isArray(matched_caregivers)) throw new Error("The triage service returned an invalid response.");
  const matches = matched_caregivers.map((match) => {
    if (!isRecord(match) || typeof match.caregiver_id !== "string" || typeof match.reason !== "string" ||
      typeof match.score !== "number" || !Number.isFinite(match.score) || match.score < 0 || match.score > 1) {
      throw new Error("The triage service returned an invalid response.");
    }
    return { caregiver_id: match.caregiver_id, score: match.score, reason: match.reason };
  });
  const parsed: TriageResponse = {
    follow_up_question,
    care_type: care_type as TriageResponse["care_type"],
    urgency: urgency as TriageResponse["urgency"],
    red_flags: red_flags as TriageResponse["red_flags"],
    reasoning,
    matched_caregivers: matches,
  };
  if ((parsed.red_flags.length > 0 || parsed.care_type === "emergency_112") &&
    (parsed.care_type !== "emergency_112" || parsed.urgency !== "emergency" || parsed.matched_caregivers.length !== 0 || !parsed.reasoning.includes("112"))) {
    throw new Error("The triage service returned an inconsistent emergency response.");
  }
  if (parsed.follow_up_question && (parsed.care_type !== null || parsed.urgency !== null || parsed.matched_caregivers.length !== 0)) {
    throw new Error("The triage service returned an inconsistent clarification response.");
  }
  return parsed;
}

const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();
const apiBase = (configuredBase || "/api").replace(/\/$/, "");

export const apiCareService: CareService = {
  async triage(request: TriageRequest): Promise<TriageResponse> {
    const response = await fetch(`${apiBase}/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`The triage service responded with status ${response.status}.`);
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error("The triage service returned unreadable JSON.");
    }
    return parseTriageResponse(payload);
  },
};
