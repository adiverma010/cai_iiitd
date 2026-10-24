import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import type { CareService, TriageResponse } from "./services/careTypes";

const ordinary: TriageResponse = {
  follow_up_question: null, care_type: "paramedic_home_visit", urgency: "same_day", red_flags: [],
  reasoning: "Prototype routing explanation.", matched_caregivers: [{ caregiver_id: "CG_001", score: 0.82, reason: "Hindi-speaking, available for teleconsultation." }],
};
function serviceFor(triage: CareService["triage"]): CareService { return { triage: vi.fn(triage) }; }
async function fillIntake(user: ReturnType<typeof userEvent.setup>, description = "Please help with a concern") {
  await user.type(screen.getByLabelText("What would you like support with?"), description);
  await user.type(screen.getByLabelText("Latitude"), "28.54");
  await user.type(screen.getByLabelText("Longitude"), "77.27");
}

describe("CareCompass API flow", () => {
  it("submits location and language, then renders synthetic caregiver matches", async () => {
    const user = userEvent.setup();
    const service = serviceFor(async () => ordinary);
    render(<App service={service} />);
    await fillIntake(user);
    await user.selectOptions(screen.getByLabelText("Choose your language"), "hinglish");
    await user.click(screen.getByRole("button", { name: /send to carecompass|carecompass ko bhejein/i }));
    expect(await screen.findByRole("heading", { name: "CareCompass response" })).toBeInTheDocument();
    expect(service.triage).toHaveBeenCalledWith(expect.objectContaining({
      user_input: "Please help with a concern", language: "hinglish", location: { lat: 28.54, lng: 77.27 }, conversation_history: [],
    }));
    await user.click(screen.getByRole("button", { name: /returned caregiver matches/i }));
    expect(screen.getByRole("heading", { name: "CG_001" })).toBeInTheDocument();
    expect(screen.getByText(/synthetic development roster/i)).toBeInTheDocument();
  });

  it("asks the backend follow-up and includes the earlier turn on continuation", async () => {
    const user = userEvent.setup();
    const triage = vi.fn<CareService["triage"]>()
      .mockResolvedValueOnce({ follow_up_question: "What is the main concern?", care_type: null, urgency: null, red_flags: [], reasoning: "More context needed.", matched_caregivers: [] })
      .mockResolvedValueOnce(ordinary);
    const service = serviceFor(triage);
    render(<App service={service} />);
    await fillIntake(user, "I need help");
    await user.click(screen.getByRole("button", { name: /send to carecompass/i }));
    expect(await screen.findByRole("heading", { name: "More detail needed" })).toBeInTheDocument();
    expect(screen.getByText("What is the main concern?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /view returned caregiver matches/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /continue with clarification/i }));
    await user.type(screen.getByLabelText("What would you like support with?"), "Fever for two days");
    await user.click(screen.getByRole("button", { name: /clarification/i }));
    expect(await screen.findByRole("heading", { name: "CareCompass response" })).toBeInTheDocument();
    expect(service.triage).toHaveBeenLastCalledWith(expect.objectContaining({ conversation_history: [{ role: "user", text: "I need help" }] }));
  });

  it("renders emergency response and never shows caregiver matches", async () => {
    const user = userEvent.setup();
    const emergency: TriageResponse = { follow_up_question: null, care_type: "emergency_112", urgency: "emergency", red_flags: ["chest_pain"], reasoning: "Potential emergency signs. Call 112 now.", matched_caregivers: [] };
    render(<App service={serviceFor(async () => emergency)} />);
    await fillIntake(user, "Chest pain");
    await user.click(screen.getByRole("button", { name: /send to carecompass/i }));
    expect(await screen.findByRole("heading", { name: "Backend emergency response" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call 112" })).toHaveAttribute("href", "tel:112");
    expect(screen.queryByRole("button", { name: /view returned caregiver matches/i })).not.toBeInTheDocument();
  });

  it("shows a no-match state when the backend returns an empty caregiver list", async () => {
    const user = userEvent.setup();
    render(<App service={serviceFor(async () => ({ ...ordinary, matched_caregivers: [] }))} />);
    await fillIntake(user);
    await user.click(screen.getByRole("button", { name: /send to carecompass/i }));
    expect(await screen.findByRole("heading", { name: "No matching profiles returned" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /view returned caregiver matches/i })).not.toBeInTheDocument();
  });

  it("keeps a polite loading status while the backend request is pending", async () => {
    const user = userEvent.setup();
    let resolve: (value: TriageResponse) => void = () => undefined;
    const service = serviceFor(() => new Promise((done) => { resolve = done; }));
    render(<App service={service} />);
    await fillIntake(user);
    await user.click(screen.getByRole("button", { name: /send to carecompass/i }));
    expect(screen.getByRole("status")).toHaveTextContent("Contacting CareCompass");
    resolve(ordinary);
    expect(await screen.findByRole("heading", { name: "CareCompass response" })).toBeInTheDocument();
  });

  it("validates description and coordinates without calling the service", async () => {
    const user = userEvent.setup();
    const service = serviceFor(async () => ordinary);
    render(<App service={service} />);
    await user.click(screen.getByRole("button", { name: /send to carecompass/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("valid latitude/longitude");
    expect(service.triage).not.toHaveBeenCalled();
  });

  it("shows a readable error when the backend is unavailable", async () => {
    const user = userEvent.setup();
    render(<App service={serviceFor(async () => { throw new TypeError("network unavailable"); })} />);
    await fillIntake(user);
    await user.click(screen.getByRole("button", { name: /send to carecompass/i }));
    expect(await screen.findByRole("heading", { name: "We could not get a verified response" })).toBeInTheDocument();
  });
});
