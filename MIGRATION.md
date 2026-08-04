# Social-Graph Schema Migration

Likes and follows currently live in unbounded arrays embedded in documents:

- `Post.likes: [ObjectId]` — every liker on the post document
- `User.followers` / `User.following: [ObjectId]` — every edge on the user document

Unbounded arrays risk the 16MB document limit and make every post/user fetch
carry the full list. The fix is dedicated edge collections:

- `Like { user: ObjectId, post: ObjectId }` — unique on `{user, post}`, index on `post`
- `Follow { follower: ObjectId, following: ObjectId }` — unique on `{follower, following}`, indexes on both fields

The migration runs in three stages so nothing breaks at any point.

## Stage 1 — Dual-write + backfill (DONE)

**Arrays remain authoritative for all reads.** The new collections are purely
additive:

- `likePost` / `dislikePost` (`backend/controllers/post.controller.js`) and the
  follow/unfollow branches of `followOrUnfollow`
  (`backend/controllers/user.controller.js`) dual-write to `Like` / `Follow`.
  Secondary writes are wrapped in try/catch and only `console.error` on
  failure — they can never fail the request.
- All secondary writes are upserts/deletes keyed by the unique compound index,
  so retries and double-taps are idempotent.
- A backfill script copies historical array data into the collections.

### Commands

```bash
# Backfill historical likes/follows into the new collections (idempotent —
# safe to run multiple times, and safe to run while the app serves traffic
# because dual-writes use the same upsert keys):
npm run migrate:social-graph
```

Nothing breaks if the backfill never runs — reads still come from the arrays.
Run it (and re-run it freely) before starting Stage 2.

### Rollback

**Nothing needed.** Stage 1 is additive: the `likes` and `follows` collections
are extra data that nothing reads yet. To fully revert, revert the code and
optionally `db.likes.drop(); db.follows.drop()` in `mongosh`.

### Parity checks

Run in `mongosh` after the backfill; both comparisons should report 0 mismatches.

```js
// Likes: array length vs Like docs per post
db.posts.aggregate([
  { $project: { arrayCount: { $size: { $ifNull: ["$likes", []] } } } },
  { $lookup: { from: "likes", localField: "_id", foreignField: "post", as: "docs" } },
  { $project: { arrayCount: 1, docCount: { $size: "$docs" } } },
  { $match: { $expr: { $ne: ["$arrayCount", "$docCount"] } } },
  { $count: "mismatchedPosts" },
]);

// Follows: following-array length vs Follow docs per user
db.users.aggregate([
  { $project: { arrayCount: { $size: { $ifNull: ["$following", []] } } } },
  { $lookup: { from: "follows", localField: "_id", foreignField: "follower", as: "docs" } },
  { $project: { arrayCount: 1, docCount: { $size: "$docs" } } },
  { $match: { $expr: { $ne: ["$arrayCount", "$docCount"] } } },
  { $count: "mismatchedUsers" },
]);

// Quick totals sanity check
db.likes.countDocuments();
db.posts.aggregate([{ $group: { _id: null, n: { $sum: { $size: { $ifNull: ["$likes", []] } } } } }]);
db.follows.countDocuments();
db.users.aggregate([{ $group: { _id: null, n: { $sum: { $size: { $ifNull: ["$following", []] } } } } }]);
```

Small transient mismatches are possible while traffic is flowing (a request
between the array write and the dual-write); re-run the check — persistent
mismatches are fixed by re-running `npm run migrate:social-graph`.

## Stage 2 — Flip reads to the collections (CURRENT — code shipped)

> **Deployment note:** run `npm run migrate:social-graph` and the parity
> checks BEFORE deploying this code — reads now come from the collections,
> so un-backfilled historical data would show zero counts.

Implemented:

- Post payloads (`getAllPost`, `getUserPost`, `getPostById`, `searchPosts`,
  public API) expose `likesCount` + `likedByMe` from the `Like` collection;
  the embedded `likes` array is no longer shipped.
- Profile payloads expose `followersCount` / `followingCount`; login and
  `/me` build the id arrays from the `Follow` collection.
- `getFollowers` / `getFollowing` cursor-paginate the `Follow` collection.
- `followOrUnfollow`, story feed, story-seen checks, and suggested users all
  read `Follow` instead of the arrays.
- Dual-writes to the arrays remain in place — that is the rollback path.

Original checklist:

- Like counts and "liked by me": `Like.countDocuments({ post })` /
  `Like.exists({ user, post })` instead of reading `post.likes`.
- Follower/following counts: `Follow.countDocuments({ following: userId })` /
  `Follow.countDocuments({ follower: userId })`.
- Follower/following lists (`getFollowers` / `getFollowing`): paginate the
  `Follow` collection (`.find({ following: userId }).sort({ _id: -1 }).limit(n)`
  with a cursor) and populate user fields — no more unbounded `populate` on
  the arrays.
- Keep the dual-writes so the arrays stay in sync — that is the Stage 2
  rollback path: flip reads back to the arrays, which never went stale.
- Re-run the parity checks above before and after the flip.

## Stage 3 — Drop the arrays

Once Stage 2 has been stable in production:

- Remove the array writes from the controllers (keep only the collection
  writes; the try/catch guards are removed and the collection writes become
  the primary, request-failing writes).
- Remove `likes` from the Post schema and `followers`/`following` from the
  User schema.
- Unset stored data:

```js
db.posts.updateMany({}, { $unset: { likes: "" } });
db.users.updateMany({}, { $unset: { followers: "", following: "" } });
```

Stage 3 is the only destructive step — take a backup/snapshot first. Rollback
after the `$unset` requires restoring the arrays from the collections (the
inverse of the backfill), so only run it after Stage 2 parity is proven.
