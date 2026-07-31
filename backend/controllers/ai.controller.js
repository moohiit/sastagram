import { isAiEnabled, generateFromImage } from "../utils/gemini.js";

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
    if (!req.file) {
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
