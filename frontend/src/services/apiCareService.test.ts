import { afterEach, describe, expect, it, vi } from "vitest";
import { apiCareService, parseTriageResponse } from "./apiCareService";
import type { TriageResponse } from "./careTypes";

const valid: TriageResponse = { follow_up_question: null, care_type: "paramedic_home_visit", urgency: "same_day", red_flags: [], reasoning: "Prototype rule.", matched_caregivers: [] };
afterEach(() => vi.unstubAllGlobals());

describe("apiCareService", () => {
  it("posts the confirmed request shape and parses a valid response", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(valid), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const request = { user_input: "Fever", language: "english" as const, location: { lat: 28.54, lng: 77.27 }, conversation_history: [] };
    await expect(apiCareService.triage(request)).resolves.toEqual(valid);
    expect(fetchMock).toHaveBeenCalledWith("/api/triage", expect.objectContaining({ method: "POST", body: JSON.stringify(request) }));
  });

  it("surfaces network failures and non-success HTTP responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    await expect(apiCareService.triage({ user_input: "x", language: "english", location: { lat: 0, lng: 0 }, conversation_history: [] })).rejects.toThrow("offline");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 422 })));
    await expect(apiCareService.triage({ user_input: "x", language: "english", location: { lat: 0, lng: 0 }, conversation_history: [] })).rejects.toThrow("status 422");
  });

  it("rejects invalid JSON, malformed payloads, and unsafe emergency responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not-json", { status: 200 })));
    await expect(apiCareService.triage({ user_input: "x", language: "english", location: { lat: 0, lng: 0 }, conversation_history: [] })).rejects.toThrow("unreadable JSON");
    expect(() => parseTriageResponse({ ...valid, matched_caregivers: [{ caregiver_id: "x", score: 3, reason: "bad" }] })).toThrow("invalid response");
    expect(() => parseTriageResponse({ ...valid, red_flags: ["chest_pain"], care_type: "home_nursing" })).toThrow("inconsistent emergency");
  });

  it("accepts clarification and zero-match payloads without making recommendations", () => {
    expect(parseTriageResponse({ ...valid, care_type: null, urgency: null, follow_up_question: "What is the main concern?" })).toMatchObject({ follow_up_question: "What is the main concern?", matched_caregivers: [] });
    expect(parseTriageResponse(valid).matched_caregivers).toEqual([]);
  });
});
