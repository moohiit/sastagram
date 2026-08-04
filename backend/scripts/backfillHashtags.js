// One-off backfill: parse #hashtags out of existing captions into the new
// Post.hashtags field. Idempotent — safe to re-run any time.
//
//   node backend/scripts/backfillHashtags.js
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { Post } from "../models/post.model.js";
import { extractHashtags } from "../utils/textEntities.js";

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("connected");

  let updated = 0;
  const cursor = Post.find({}, { caption: 1, hashtags: 1 }).lean().cursor();
  for await (const post of cursor) {
    const tags = extractHashtags(post.caption || "");
    const existing = post.hashtags || [];
    const same =
      tags.length === existing.length && tags.every((t) => existing.includes(t));
    if (same) continue;
    await Post.updateOne({ _id: post._id }, { $set: { hashtags: tags } });
    updated += 1;
  }
  console.log(`done — ${updated} posts updated`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
