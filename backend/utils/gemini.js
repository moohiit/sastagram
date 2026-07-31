// Minimal Gemini REST client (no SDK dependency). All AI features are
// optional: when GEMINI_API_KEY is not configured, isAiEnabled() is false
// and callers hide/skip their features gracefully.
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const isAiEnabled = () => Boolean(process.env.GEMINI_API_KEY);

export const generateFromImage = async ({ imageBuffer, mimeType, prompt, maxOutputTokens = 512 }) => {
  if (!isAiEnabled()) throw new Error("AI is not configured");
  const body = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: imageBuffer.toString("base64") } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: { maxOutputTokens, temperature: 0.9 },
  };
  const res = await fetch(`${BASE}/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini error ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
};

// Text → 768-dim embedding vector (gemini-embedding-001). Used for semantic
// post search; callers must check isAiEnabled() or handle the throw.
export const embedText = async (text) => {
  if (!isAiEnabled()) throw new Error("AI is not configured");
  const body = {
    model: "models/gemini-embedding-001",
    content: { parts: [{ text }] },
    outputDimensionality: 768,
  };
  const res = await fetch(
    `${BASE}/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini error ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  const values = data?.embedding?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Gemini embedding response had no values");
  }
  return values;
};

export const generateFromText = async ({ prompt, maxOutputTokens = 256, temperature = 0.2 }) => {
  if (!isAiEnabled()) throw new Error("AI is not configured");
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens, temperature },
  };
  const res = await fetch(`${BASE}/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini error ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
};
