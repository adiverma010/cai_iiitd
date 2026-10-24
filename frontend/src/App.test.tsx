import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const location = { lat: 28.54, lng: 77.27 };

function apiResponse(overrides: Record<string, unknown> = {}) {
  return {
    follow_up_question: null,
    care_type: "home_nursing",
    urgency: "same_day",
    red_flags: [],
    reasoning: "Based on the supplied request.",
    matched_caregivers: [
      { caregiver_id: "CG_014", score: 0.92, reason: "Speaks Hindi and is nearby." },
    ],
    ...overrides,
  };
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function enterDescription(value: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("What would you like support with?"), value);
  await user.click(screen.getByRole("button", { name: /get care options|देखभाल विकल्प देखें|care options dekhein/i }));
  return user;
}

afterEach(() => vi.unstubAllGlobals());

beforeEach(() => {
  render(<App locate={async () => location} />);
});

describe("CareCompass API integration", () => {
  it("submits the backend request and renders ordinary triage matches", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(apiResponse()));
    vi.stubGlobal("fetch", fetchMock);

    await enterDescription("I need a nurse");

    expect(await screen.findByText("CG_014")).toBeInTheDocument();
    expect(screen.getByText("Speaks Hindi and is nearby.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/triage");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      user_input: "I need a nurse",
      language: "auto",
      location,
      conversation_history: [],
    });
  });

  it("keeps follow-up answers on screen 02 and submits each answer with conversation history", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(apiResponse({
        follow_up_question: "How long have these symptoms been present?",
        care_type: null,
        urgency: null,
        matched_caregivers: [],
      })))
      .mockResolvedValueOnce(response(apiResponse({
        follow_up_question: "Would you like a home visit or a doctor consultation?",
        care_type: null,
        urgency: null,
        matched_caregivers: [],
      })))
      .mockResolvedValueOnce(response(apiResponse()));
    vi.stubGlobal("fetch", fetchMock);

    const user = await enterDescription("I need a doctor");
    expect(await screen.findByTestId("follow-up-question")).toHaveTextContent(
      "How long have these symptoms been present?",
    );
    expect(screen.getByText("02 / 02")).toBeInTheDocument();
    expect(screen.queryByText("Home nursing")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /answer the follow-up question/i }));
    const answerField = screen.getByLabelText("Please add the details requested");
    expect(answerField).toHaveFocus();
    expect(screen.queryByText("CARE INTAKE")).not.toBeInTheDocument();
    await user.type(answerField, "Since yesterday");
    await user.click(screen.getByRole("button", { name: /send details/i }));
    expect(await screen.findByTestId("follow-up-question")).toHaveTextContent(
      "Would you like a home visit or a doctor consultation?",
    );
    expect(screen.getByText("I need a doctor")).toBeInTheDocument();
    expect(screen.getByText("Since yesterday")).toBeInTheDocument();
    expect(screen.getByText("02 / 02")).toBeInTheDocument();
    expect(screen.queryByText("CARE INTAKE")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /answer the follow-up question/i }));
    await user.type(answerField, "Doctor consultation");
    await user.click(screen.getByRole("button", { name: /send details/i }));
    expect(await screen.findByText("CG_014")).toBeInTheDocument();

    const secondRequest = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body));
    expect(secondRequest).toEqual({
      user_input: "Since yesterday",
      language: "auto",
      location,
      conversation_history: [{ role: "user", text: "I need a doctor" }],
    });
    const thirdRequest = JSON.parse(String((fetchMock.mock.calls[2] as [string, RequestInit])[1].body));
    expect(thirdRequest.conversation_history).toEqual([
      { role: "user", text: "I need a doctor" },
      { role: "user", text: "Since yesterday" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(thirdRequest.user_input).toBe("Doctor consultation");
  });

  it("preserves a failed follow-up answer and retries it without duplicating history", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(apiResponse({
        follow_up_question: "What nursing task is needed?",
        care_type: null,
        urgency: null,
        matched_caregivers: [],
      })))
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(response(apiResponse()));
    vi.stubGlobal("fetch", fetchMock);

    const user = await enterDescription("I need a nurse");
    expect(await screen.findByTestId("follow-up-question")).toHaveTextContent("What nursing task is needed?");
    const answer = screen.getByLabelText("Please add the details requested");
    await user.type(answer, "A wound dressing");
    await user.click(screen.getByRole("button", { name: /send details/i }));

    expect(await screen.findByText(/could not be reached/i)).toBeInTheDocument();
    expect(screen.getByText("I need a nurse")).toBeInTheDocument();
    expect(screen.getByText("A wound dressing")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.getByLabelText("Please add the details requested")).toHaveValue("A wound dressing");
    await user.click(screen.getByRole("button", { name: /send details/i }));
    expect(await screen.findByText("CG_014")).toBeInTheDocument();

    const retryRequest = JSON.parse(String((fetchMock.mock.calls[2] as [string, RequestInit])[1].body));
    expect(retryRequest.user_input).toBe("A wound dressing");
    expect(retryRequest.conversation_history).toEqual([{ role: "user", text: "I need a nurse" }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("overrides caregiver matches when the API signals an emergency", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(apiResponse({
      care_type: "emergency_112",
      urgency: "emergency",
      red_flags: ["chest_pain"],
    })));
    vi.stubGlobal("fetch", fetchMock);

    await enterDescription("severe chest pain");

    expect(await screen.findByRole("link", { name: /call 112/i })).toHaveAttribute("href", "tel:112");
    expect(screen.queryByText("CG_014")).not.toBeInTheDocument();
  });

  it("shows a recoverable service error for network and non-2xx failures", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchMock);
    await enterDescription("I need care");
    expect(await screen.findByText(/could not be reached/i)).toBeInTheDocument();
    expect(screen.getByText("I need care")).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.getByLabelText("What would you like support with?")).toHaveValue("I need care");
    fetchMock.mockResolvedValueOnce(new Response("service unavailable", { status: 503 }));
    await userEvent.setup().click(screen.getByRole("button", { name: /get care options/i }));
    expect(await screen.findByText(/could not process this request/i)).toBeInTheDocument();
    expect(screen.getByText("I need care")).toBeInTheDocument();
  });

  it("prevents duplicate submissions while a request is loading", async () => {
    let resolveResponse: (value: Response) => void = () => undefined;
    const fetchMock = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("What would you like support with?"), "I need a nurse");
    await user.click(screen.getByRole("button", { name: /get care options/i }));
    const submitButton = screen.getByRole("button", { name: /connecting to the care service/i });
    expect(submitButton).toBeDisabled();
    await user.click(submitButton);
    expect(fetchMock).toHaveBeenCalledOnce();
    resolveResponse(response(apiResponse()));
    expect(await screen.findByText("CG_014")).toBeInTheDocument();
  });

  it("starts a new case with no previous conversation or result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(apiResponse()));
    vi.stubGlobal("fetch", fetchMock);
    await enterDescription("I need a nurse");
    expect(await screen.findByText("CG_014")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /start again/i }));
    expect(screen.getByLabelText("What would you like support with?")).toHaveValue("");
    expect(screen.queryByText("I need a nurse")).not.toBeInTheDocument();
    expect(screen.queryByText("CG_014")).not.toBeInTheDocument();
  });

  it("handles invalid JSON and empty caregiver results", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("not-json", { status: 200 }))
      .mockResolvedValueOnce(response(apiResponse({ matched_caregivers: [] })));
    vi.stubGlobal("fetch", fetchMock);
    await enterDescription("I need care");
    expect(await screen.findByText(/unreadable response/i)).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    await enterDescription("No nearby matches");
    expect(await screen.findByText(/no eligible caregiver matches/i)).toBeInTheDocument();
  });

  it("supports demo booking simulation, outbound actions, and consultation preparation handoff", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(apiResponse()));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    await enterDescription("I need home nursing for an injection");

    expect(await screen.findByText("CG_014")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /call provider/i })).toHaveAttribute("href", "tel:+911140001000");
    expect(screen.getByRole("link", { name: /directions/i })).toHaveAttribute("href", expect.stringContaining("maps.google.com"));

    // Demo booking
    const demoBookingBtn = screen.getByRole("button", { name: /simulate demo booking/i });
    await user.click(demoBookingBtn);
    expect(screen.getByRole("status")).toHaveTextContent(/demo request created/i);

    // Consultation prep note
    const prepTextarea = screen.getByLabelText("Editable consultation preparation note") as HTMLTextAreaElement;
    expect(prepTextarea.value).toContain("CONSULTATION PREPARATION NOTE");
    expect(prepTextarea.value).toContain("I need home nursing for an injection");

    // Copy note
    const copyBtn = screen.getByRole("button", { name: /copy preparation note/i });
    expect(copyBtn).toBeInTheDocument();
  });

  it("triggers provider discovery when requested", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(apiResponse()))
      .mockResolvedValueOnce(response({
        status: "live_verified",
        care_type: "home_nursing",
        providers: [{
          provider_id: "TF_01",
          provider_name: "Apollo HomeCare Delhi",
          care_type: "home_nursing",
          official_url: "https://www.apollohomecare.com",
          source_urls: ["https://www.apollohomecare.com"],
          checked_at: "2026-10-24T10:00:00Z",
          verification_status: "verified",
          availability: "unknown",
          action_status: "not_started",
        }],
        message: "Live verified",
        checked_at: "2026-10-24T10:00:00Z",
      }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    await enterDescription("I need home nursing");
    expect(await screen.findByText("CG_014")).toBeInTheDocument();

    const discoverBtn = screen.getByRole("button", { name: /find live providers \(tinyfish\)/i });
    await user.click(discoverBtn);

    expect(await screen.findByText("Apollo HomeCare Delhi")).toBeInTheDocument();
    expect(screen.getByText(/verified public domain/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /official website/i })).toHaveAttribute("href", "https://www.apollohomecare.com");
  });
});
