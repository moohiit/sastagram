// Stage-1 backfill for the social-graph migration (see MIGRATION.md).
//
// Copies existing array data into the new edge collections:
//   Post.likes[]      -> Like  { user, post }
//   User.following[]  -> Follow { follower, following }
//
// Idempotent: every write is an upsert keyed by the unique compound index, so
// the script can be re-run safely at any time. Arrays remain authoritative;
// this script only adds documents.
//
// Usage: npm run migrate:social-graph  (requires MONGO_URI in .env)
import "dotenv/config";
import mongoose from "mongoose";
import { Post } from "../models/post.model.js";
import { User } from "../models/user.model.js";
import { Like } from "../models/like.model.js";
import { Follow } from "../models/follow.model.js";

const BATCH_SIZE = 500;

async function flush(model, ops) {
  if (ops.length === 0) return { upserted: 0, matched: 0 };
  const res = await model.bulkWrite(ops, { ordered: false });
  return { upserted: res.upsertedCount, matched: res.matchedCount };
}

async function backfillLikes() {
  let posts = 0;
  let edges = 0;
  let upserted = 0;
  let ops = [];

  const cursor = Post.find({}, { likes: 1 }).lean().cursor();
  for await (const post of cursor) {
    posts++;
    for (const userId of post.likes || []) {
      edges++;
      ops.push({
        updateOne: {
          filter: { user: userId, post: post._id },
          update: { $setOnInsert: { user: userId, post: post._id } },
          upsert: true,
        },
      });
      if (ops.length >= BATCH_SIZE) {
        upserted += (await flush(Like, ops)).upserted;
        ops = [];
      }
    }
    if (posts % 1000 === 0) {
      console.log(`  likes: processed ${posts} posts (${edges} likes so far)`);
    }
  }
  upserted += (await flush(Like, ops)).upserted;

  console.log(
    `Likes backfill: ${posts} posts scanned, ${edges} like edges, ` +
      `${upserted} new Like docs created (${edges - upserted} already existed)`
  );
}

async function backfillFollows() {
  let users = 0;
  let edges = 0;
  let upserted = 0;
  let ops = [];

  const cursor = User.find({}, { following: 1 }).lean().cursor();
  for await (const user of cursor) {
    users++;
    for (const followingId of user.following || []) {
      edges++;
      ops.push({
        updateOne: {
          filter: { follower: user._id, following: followingId },
          update: {
            $setOnInsert: { follower: user._id, following: followingId },
          },
          upsert: true,
        },
      });
      if (ops.length >= BATCH_SIZE) {
        upserted += (await flush(Follow, ops)).upserted;
        ops = [];
      }
    }
    if (users % 1000 === 0) {
      console.log(`  follows: processed ${users} users (${edges} follows so far)`);
    }
  }
  upserted += (await flush(Follow, ops)).upserted;

  console.log(
    `Follows backfill: ${users} users scanned, ${edges} follow edges, ` +
      `${upserted} new Follow docs created (${edges - upserted} already existed)`
  );
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set (check your .env)");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected. Backfilling social graph (idempotent upserts)...");

  await backfillLikes();
  await backfillFollows();

  console.log(
    `Totals now in collections: ${await Like.countDocuments()} likes, ` +
      `${await Follow.countDocuments()} follows`
  );

  await mongoose.disconnect();
  console.log("Done.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
