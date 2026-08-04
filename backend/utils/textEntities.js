import { User } from "../models/user.model.js";
import { notify } from "./notify.js";

// #tag: letters/digits/underscore, 1-50 chars, stored lowercase
export const extractHashtags = (text = "") => [
  ...new Set(
    (text.match(/#[\p{L}\p{N}_]{1,50}/gu) || []).map((t) =>
      t.slice(1).toLowerCase()
    )
  ),
];

// @username: same charset/length rules as registration usernames
export const extractMentions = (text = "") => [
  ...new Set((text.match(/@[a-zA-Z0-9._-]{3,30}/g) || []).map((t) => t.slice(1))),
];

// Notify every existing user @mentioned in `text`. Never throws — a failed
// mention notification must not fail the post/comment that triggered it.
export const notifyMentions = async ({ text, sender, post = null }) => {
  try {
    const usernames = extractMentions(text);
    if (!usernames.length) return;
    const users = await User.find({ username: { $in: usernames } }).select("_id");
    await Promise.all(
      users.map((u) =>
        notify({
          recipient: u._id,
          sender,
          type: "mention",
          post,
          text: "mentioned you",
        })
      )
    );
  } catch (error) {
    console.error("mention notify failed:", error.message);
  }
};
