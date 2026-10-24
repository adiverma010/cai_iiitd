import { describe, expect, it } from "vitest";
import { detectUiLanguage } from "./languageDetection";

describe("automatic input language detection", () => {
  it("detects English, Devanagari Hindi, and Romanized Hinglish", () => {
    expect(detectUiLanguage("I have had a fever for two days")).toBe("en");
    expect(detectUiLanguage("पापा को दो दिन से बुखार है")).toBe("hi");
    expect(detectUiLanguage("papa ko do din se bukhar hai")).toBe("hinglish");
    expect(detectUiLanguage("मुझे fever है और cough भी")).toBe("hinglish");
  });

  it("keeps short ambiguous input at the current language instead of guessing Hinglish", () => {
    expect(detectUiLanguage("Hi")).toBe("en");
    expect(detectUiLanguage("No", "hi")).toBe("hi");
  });

  it("recognizes a complete English emergency phrase after ambiguous typing prefixes", () => {
    expect(detectUiLanguage("severe chest pain", "hinglish")).toBe("en");
  });
});
