export type UiLanguage = "en" | "hi" | "hinglish";

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

export interface Location {
  lat: number;
  lng: number;
}

export interface ConversationTurn {
  role: "user";
  text: string;
}

export interface TriageRequest {
  user_input: string;
  language: "auto";
  location: Location;
  conversation_history: ConversationTurn[];
}

export interface CaregiverMatch {
  caregiver_id: string;
  score: number;
  reason: string;
  name?: string;
  role?: string;
  base_area?: string;
  phone?: string;
}

export interface TriageResponse {
  follow_up_question: string | null;
  care_type: CareType | null;
  urgency: Urgency | null;
  red_flags: RedFlag[];
  reasoning: string;
  matched_caregivers: CaregiverMatch[];
}

export interface ProviderRecord {
  provider_id: string;
  provider_name: string;
  care_type: string;
  address?: string | null;
  phone?: string | null;
  official_url: string;
  booking_url?: string | null;
  published_hours?: string | null;
  availability: "available" | "unavailable" | "unknown";
  source_urls: string[];
  checked_at: string;
  verification_status: "verified" | "partial" | "unknown";
  action_status: "not_started" | "handoff_opened" | "request_submitted" | "provider_confirmed";
}

export interface DiscoveryResponse {
  status: "live_verified" | "demo_grounded" | "empty" | "suppressed_emergency";
  care_type: string;
  providers: ProviderRecord[];
  message: string;
  checked_at: string;
}

export interface CareService {
  submit(request: TriageRequest): Promise<TriageResponse>;
  discoverProviders?(careType: string, locationLabel?: string): Promise<DiscoveryResponse>;
}
