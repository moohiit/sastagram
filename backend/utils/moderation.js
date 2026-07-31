import { isAiEnabled, generateFromText } from "./gemini.js";

// Soft toxicity check for comments. Fails OPEN: any AI error or missing key
// means the comment is allowed — moderation must never break commenting.
export const isToxicComment = async (text) => {
  if (!isAiEnabled()) return false;
  try {
    const verdict = await generateFromText({
      prompt:
        "You are a content moderator for a photo-sharing app. Is the following " +
        "comment toxic (harassment, hate, insult, threat, or sexually explicit)? " +
        `Reply with exactly one word: YES or NO.\n\nComment: """${text.slice(0, 500)}"""`,
      maxOutputTokens: 4,
      temperature: 0,
    });
    return verdict.trim().toUpperCase().startsWith("YES");
  } catch (error) {
    console.error("moderation check failed (allowing comment):", error.message);
    return false;
  }
};
