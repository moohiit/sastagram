import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // fullname: { type: String},
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePicture: { type: String, default: "" },
    bio: { type: String, default: "" },
    gender: { type: String, enum: ["male", "female", "other"] },
    // Stage 3 (MIGRATION.md): follower/following edges live exclusively in
    // the Follow collection — the embedded arrays are gone.
    posts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
    lastActiveAt: { type: Date },
    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
    // Private accounts require an accepted follow request to see posts
    isPrivate: { type: Boolean, default: false },
    // Users this account has blocked (small list; never exposed to others)
    blocked: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);