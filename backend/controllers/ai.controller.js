import { isAiEnabled, generateFromImage, generateFromText } from "../utils/gemini.js";

// GET /api/v1/ai/status — lets the frontend show/hide AI features
export const getAiStatus = (req, res) => {
  return res.status(200).json({ success: true, enabled: isAiEnabled() });
};

// POST /api/v1/ai/captions — image upload → 3 caption suggestions
export const suggestCaptions = async (req, res) => {
  try {
    if (!isAiEnabled()) {
      return res.status(503).json({ success: false, message: "AI features are not configured" });
    }
    if (!req.file || !req.file.mimetype?.startsWith("image/")) {
      return res.status(400).json({ success: false, message: "Image required" });
    }
    const raw = await generateFromImage({
      imageBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
      prompt:
        "You write Instagram captions. Look at this photo and write exactly 3 caption options:\n" +
        "1. witty (max 12 words, may include one emoji)\n" +
        "2. minimal (max 5 words, lowercase aesthetic)\n" +
        "3. descriptive (one evocative sentence)\n" +
        'Reply with ONLY a JSON array of 3 strings, e.g. ["...","...","..."] — no markdown, no keys.',
    });
    // Parse defensively: model may wrap JSON in a code fence
    const jsonText = raw.replace(/```json|```/g, "").trim();
    let captions;
    try {
      captions = JSON.parse(jsonText);
    } catch {
      // Fallback: split lines, strip list markers
      captions = raw.split("\n").map((l) => l.replace(/^[\d\.\-\*\s"]+|"$/g, "").trim()).filter(Boolean).slice(0, 3);
    }
    if (!Array.isArray(captions) || captions.length === 0) {
      return res.status(502).json({ success: false, message: "Could not generate captions, try again" });
    }
    return res.status(200).json({ success: true, captions: captions.slice(0, 3).map(String) });
  } catch (error) {
    console.error("AI captions failed:", error.message);
    return res.status(502).json({ success: false, message: "Caption generation failed, try again" });
  }
};

// POST /api/v1/ai/replies — smart reply suggestions for a DM thread.
// Body: { messages: [{ fromMe: boolean, text: string }] } — the most recent
// few messages, oldest first. Returns 3 short suggestions.
export const suggestReplies = async (req, res) => {
  try {
    if (!isAiEnabled()) {
      return res.status(503).json({ success: false, message: "AI features are not configured" });
    }
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, message: "messages array is required" });
    }
    const recent = messages
      .slice(-8)
      .filter((m) => m && typeof m.text === "string" && m.text.trim())
      .map((m) => `${m.fromMe ? "Me" : "Them"}: ${m.text.trim().slice(0, 300)}`);
    if (recent.length === 0) {
      return res.status(400).json({ success: false, message: "messages array is required" });
    }
    const raw = await generateFromText({
      prompt:
        "You suggest quick replies in a casual chat app conversation between friends.\n" +
        "Conversation (oldest first):\n" +
        recent.join("\n") +
        "\n\nWrite exactly 3 short reply options I ('Me') could send next. " +
        "Casual tone, max 8 words each, emoji allowed, no greetings unless natural.\n" +
        'Reply with ONLY a JSON array of 3 strings, e.g. ["...","...","..."] — no markdown.',
      temperature: 0.9,
      maxOutputTokens: 128,
    });
    const jsonText = raw.replace(/```json|```/g, "").trim();
    let replies;
    try {
      replies = JSON.parse(jsonText);
    } catch {
      replies = raw
        .split("\n")
        .map((l) => l.replace(/^[\d.\-*\s"]+|"$/g, "").trim())
        .filter(Boolean)
        .slice(0, 3);
    }
    if (!Array.isArray(replies) || replies.length === 0) {
      return res.status(502).json({ success: false, message: "Could not generate replies" });
    }
    return res.status(200).json({ success: true, replies: replies.slice(0, 3).map(String) });
  } catch (error) {
    console.error("AI replies failed:", error.message);
    return res.status(502).json({ success: false, message: "Reply suggestions failed, try again" });
  }
};
