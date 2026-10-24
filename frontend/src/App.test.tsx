import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import type { CareService, DemoRequest, DemoResponse } from "./services/careTypes";

function createService(overrides: Partial<CareService> = {}): CareService {
  return {
    submit: vi.fn(async () => ({ kind: "result" as const, message: "Mock result only", caregivers: [] })),
    ...overrides,
  };
}

describe("CareCompass demonstration flow", () => {
  it("shows the loading state while the mock response is pending", async () => {
    const user = userEvent.setup();
    let resolveSubmit: (response: DemoResponse) => void = () => undefined;
    const service: CareService = {
      submit: vi.fn(() => new Promise<DemoResponse>((resolve) => { resolveSubmit = resolve; })),
    };
    render(<App service={service} />);
    await user.type(screen.getByLabelText("What would you like support with?"), "Example");
    await user.click(screen.getByRole("button", { name: /show mock result/i }));

    expect(screen.getByRole("status")).toHaveTextContent("Loading demonstration");
    resolveSubmit({ kind: "result", message: "Finished.", caregivers: [] });
    expect(await screen.findByRole("heading", { name: "Example result" })).toBeInTheDocument();
  });

  it("switches intake copy to Hindi when selected", async () => {
    const user = userEvent.setup();
    render(<App service={createService()} />);

    await user.selectOptions(screen.getByLabelText("Choose your language"), "hi");

    expect(screen.getByLabelText("आपको किस बात में सहायता चाहिए?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "डेमो परिणाम दिखाएँ" })).toBeInTheDocument();
  });

  it("validates an empty description without submitting", async () => {
    const user = userEvent.setup();
    const service = createService();
    render(<App service={service} />);

    await user.click(screen.getByRole("button", { name: /show mock result/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Please enter a short description");
    expect(service.submit).not.toHaveBeenCalled();
  });

  it("shows a mock result and then clearly labelled caregiver placeholders", async () => {
    const user = userEvent.setup();
    const service = createService({
      submit: vi.fn(async () => ({
        kind: "result" as const,
        message: "No official urgency taxonomy is connected.",
        caregivers: [
          { id: "demo-a", label: "Mock caregiver profile A", description: "Placeholder only." },
        ],
      })),
    });
    render(<App service={service} />);
    await user.type(screen.getByLabelText("What would you like support with?"), "I need a demo");
    await user.click(screen.getByRole("button", { name: /show mock result/i }));

    expect(await screen.findByRole("heading", { name: "Example result" })).toBeInTheDocument();
    expect(screen.getByText("Mock development output")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /view mock caregiver examples/i }));
    expect(screen.getByRole("heading", { name: "Caregiver examples" })).toBeInTheDocument();
    expect(screen.getByText("MOCK PROFILE")).toBeInTheDocument();
    expect(screen.getByText(/not real caregivers or recommendations/i)).toBeInTheDocument();
  });

  it("shows a demonstration-only emergency screen selected by the mock control", async () => {
    const user = userEvent.setup();
    const service = createService({
      submit: vi.fn(async () => ({ kind: "emergency-demo" as const, message: "Selected demonstration state." })),
    });
    render(<App service={service} />);
    await user.type(screen.getByLabelText("What would you like support with?"), "Anything typed here");
    await user.selectOptions(screen.getByLabelText("Demonstration screen"), "emergency");
    await user.click(screen.getByRole("button", { name: /show mock result/i }));

    expect(await screen.findByRole("heading", { name: "Emergency-screen demonstration" })).toBeInTheDocument();
    expect(screen.getByText(/not based on the description you entered/i)).toBeInTheDocument();
    expect(service.submit).toHaveBeenCalledWith(expect.objectContaining({ scenario: "emergency" }));
  });

  it("shows no-match and service-error states", async () => {
    const user = userEvent.setup();
    const service = createService({
      submit: vi.fn(async (request: DemoRequest) => {
        if (request.scenario === "error") throw new Error("offline");
        return { kind: "no-match" as const, message: "No demo profiles." };
      }),
    });
    render(<App service={service} />);
    await user.type(screen.getByLabelText("What would you like support with?"), "Example");
    await user.selectOptions(screen.getByLabelText("Demonstration screen"), "error");
    await user.click(screen.getByRole("button", { name: /show mock result/i }));
    expect(await screen.findByRole("heading", { name: "The demo could not load" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /start again/i }));
    await user.type(screen.getByLabelText("What would you like support with?"), "Example");
    await user.selectOptions(screen.getByLabelText("Demonstration screen"), "no-match");
    await user.click(screen.getByRole("button", { name: /show mock result/i }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "No example profiles in this demo" })).toBeInTheDocument());
  });
});
