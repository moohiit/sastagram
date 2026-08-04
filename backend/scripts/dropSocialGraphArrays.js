// Stage 3 of the social-graph migration (see MIGRATION.md): permanently
// removes the legacy embedded arrays — Post.likes and User.followers/
// following — after verifying the Like/Follow collections hold at least as
// many edges as the arrays do.
//
// DESTRUCTIVE. Take a database backup/snapshot before running.
//
//   npm run migrate:drop-social-arrays          # parity check + unset
//   FORCE=1 npm run migrate:drop-social-arrays  # skip the parity gate
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log("connected");

  // Raw array totals (schema no longer declares these fields, so count on
  // the raw collections)
  const [postAgg] = await db
    .collection("posts")
    .aggregate([
      { $group: { _id: null, n: { $sum: { $size: { $ifNull: ["$likes", []] } } } } },
    ])
    .toArray();
  const [userAgg] = await db
    .collection("users")
    .aggregate([
      { $group: { _id: null, n: { $sum: { $size: { $ifNull: ["$following", []] } } } } },
    ])
    .toArray();
  const arrayLikes = postAgg?.n ?? 0;
  const arrayFollows = userAgg?.n ?? 0;
  const collLikes = await db.collection("likes").countDocuments();
  const collFollows = await db.collection("follows").countDocuments();

  console.log(`likes:   arrays=${arrayLikes}  collection=${collLikes}`);
  console.log(`follows: arrays=${arrayFollows}  collection=${collFollows}`);

  // Arrays may legitimately be SMALLER than the collections (Stage-3 code
  // only writes to the collections), but a collection smaller than the
  // arrays means un-migrated data — refuse to destroy it.
  if (!process.env.FORCE && (collLikes < arrayLikes || collFollows < arrayFollows)) {
    console.error(
      "ABORT: the collections hold fewer edges than the arrays — run " +
        "`npm run migrate:social-graph` first (or FORCE=1 to override)."
    );
    process.exit(1);
  }

  const posts = await db
    .collection("posts")
    .updateMany({ likes: { $exists: true } }, { $unset: { likes: "" } });
  const users = await db
    .collection("users")
    .updateMany(
      { $or: [{ followers: { $exists: true } }, { following: { $exists: true } }] },
      { $unset: { followers: "", following: "" } }
    );
  console.log(`unset likes on ${posts.modifiedCount} posts`);
  console.log(`unset followers/following on ${users.modifiedCount} users`);
  console.log("done — Stage 3 complete.");
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
