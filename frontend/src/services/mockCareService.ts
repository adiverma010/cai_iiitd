import { mockCaregiverProfiles } from "./mockCareData";
import type { CareService, DemoRequest, DemoResponse } from "./careTypes";

function waitForDemo(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 280));
}

/**
 * Development-only adapter. It does not inspect or classify the description.
 * The selected demo scenario alone determines the mock screen shown.
 */
export const mockCareService: CareService = {
  async submit(request: DemoRequest): Promise<DemoResponse> {
    await waitForDemo();

    switch (request.scenario) {
      case "standard":
        return {
          kind: "result",
          message: "No official urgency taxonomy or real care routing is connected to this demo.",
          caregivers: mockCaregiverProfiles,
        };
      case "no-match":
        return {
          kind: "no-match",
          message: "This demonstration scenario contains no example caregiver profiles.",
        };
      case "error":
        throw new Error("Demonstration service error");
      case "emergency":
        return {
          kind: "emergency-demo",
          message: "This screen is shown only because the demonstration scenario was selected. It is not based on the description.",
        };
    }
  },
};
