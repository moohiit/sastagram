import { Post } from "../models/post.model.js";
import { isAiEnabled, generateFromImage, embedText } from "./gemini.js";

// Fire-and-forget upload-time AI enrichment: alt-text + semantic embedding.
// Called WITHOUT await from addNewPost so upload response time is unchanged.
// Everything is best-effort — any failure is logged and swallowed; the post
// simply stays without altText/embedding (all readers handle that).
export const enrichPostAI = async (postId, imageBuffer, mimeType, caption = "") => {
  if (!isAiEnabled()) return;
  try {
    // 1) Concise factual description for accessibility
    const description = (
      await generateFromImage({
        imageBuffer,
        mimeType,
        prompt:
          "Write a concise, factual description of this photo for use as accessibility alt text. " +
          'Maximum 25 words. Do not start with "image of", "photo of" or similar. ' +
          "Reply with the description only.",
        maxOutputTokens: 128,
      })
    ).trim();
    if (description) {
      await Post.findByIdAndUpdate(postId, { altText: description });
    }

    // 2) Semantic embedding of caption + description
    const embedding = await embedText(`${caption || ""}\n${description}`.trim());
    await Post.findByIdAndUpdate(postId, { embedding });
  } catch (error) {
    console.error(`Post AI enrichment failed for ${postId}:`, error.message);
  }
};
