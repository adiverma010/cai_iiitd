import { describe, expect, it } from "vitest";
import { mockCareService } from "./mockCareService";

const request = {
  description: "A demo description",
  language: "en" as const,
};

describe("mockCareService", () => {
  it("returns placeholder profiles only for the selected example scenario", async () => {
    const response = await mockCareService.submit({ ...request, scenario: "standard" });

    expect(response.kind).toBe("result");
    if (response.kind === "result") {
      expect(response.caregivers).toHaveLength(2);
      expect(response.caregivers[0].label).toContain("Mock");
    }
  });

  it("does not classify the description to choose the emergency demonstration", async () => {
    const response = await mockCareService.submit({ ...request, description: "anything", scenario: "emergency" });

    expect(response.kind).toBe("emergency-demo");
  });

  it("supports explicit no-match and error demonstration scenarios", async () => {
    await expect(mockCareService.submit({ ...request, scenario: "no-match" })).resolves.toMatchObject({ kind: "no-match" });
    await expect(mockCareService.submit({ ...request, scenario: "error" })).rejects.toThrow("Demonstration service error");
  });
});
