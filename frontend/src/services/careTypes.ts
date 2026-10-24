export type Language = "en" | "hi" | "hinglish";

export type DemoScenario = "standard" | "no-match" | "error" | "emergency";

export interface DemoRequest {
  description: string;
  language: Language;
  scenario: DemoScenario;
}

export interface MockCaregiverProfile {
  id: string;
  label: string;
  description: string;
}

/** Presentation-only demo responses; these are not the backend API contract. */
export type DemoResponse =
  | { kind: "result"; message: string; caregivers: readonly MockCaregiverProfile[] }
  | { kind: "no-match"; message: string }
  | { kind: "emergency-demo"; message: string };

/** Replace this UI boundary after Aditya approves the real API contract. */
export interface CareService {
  submit(request: DemoRequest): Promise<DemoResponse>;
}
