export type Language = "en" | "hi" | "hinglish";

export type CareType =
  | "paramedic_home_visit"
  | "home_nursing"
  | "lab_test_home"
  | "teleconsultation"
  | "emergency_112";
export type Urgency = "emergency" | "same_day" | "scheduled";
export type RedFlag =
  | "chest_pain"
  | "breathlessness"
  | "unconsciousness"
  | "severe_bleeding"
  | "stroke_symptoms"
  | "seizure"
  | "high_fever_infant"
  | "suicidal_ideation"
  | "severe_dehydration";

export interface TriageRequest {
  user_input: string;
  language: "english" | "hindi" | "hinglish";
  location: { lat: number; lng: number };
  conversation_history: Array<{ role: string; text: string }>;
}

export interface CaregiverMatch {
  caregiver_id: string;
  score: number;
  reason: string;
}

/** Mirrors the confirmed Pydantic TriageResponse contract. */
export interface TriageResponse {
  follow_up_question: string | null;
  care_type: CareType | null;
  urgency: Urgency | null;
  red_flags: RedFlag[];
  reasoning: string;
  matched_caregivers: CaregiverMatch[];
}

/** Replaceable boundary; the HTTP implementation owns wire validation. */
export interface CareService {
  triage(request: TriageRequest): Promise<TriageResponse>;
}
