import type { UiLanguage } from "./careTypes";

const romanHindiCue = /\b(?:aap|apni|bukhar|chahiye|dard|hai|hain|ho|kar|ke|ki|ko|mujhe|mummy|nahi|nahin|papa|raha|rahi|saans|se|khansi)\b/i;
const englishCue = /\b(?:and|chest|cough|fever|for|have|help|i|is|my|need|pain|please|the|want|with)\b/i;

export function detectUiLanguage(text: string, fallback: UiLanguage = "en"): UiLanguage {
  if (!text.trim()) return fallback;
  const hasDevanagari = /[\u0900-\u097f]/.test(text);
  if (hasDevanagari) return englishCue.test(text) ? "hinglish" : "hi";
  if (romanHindiCue.test(text)) return "hinglish";
  const words = text.match(/[\p{L}]+/gu) ?? [];
  if (words.length >= 2 && englishCue.test(text)) return "en";
  return fallback;
}
