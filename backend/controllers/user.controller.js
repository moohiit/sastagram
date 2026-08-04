import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import getDataUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";
import { Post } from "../models/post.model.js";
import { Follow } from "../models/follow.model.js";
import { FollowRequest } from "../models/followRequest.model.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { Notification } from "../models/notification.model.js";
import { Story } from "../models/story.model.js";
import { Message } from "../models/message.model.js";
import { Conversation } from "../models/conversation.model.js";
import { PushSubscription } from "../models/pushSubscription.model.js";
import { notify } from "../utils/notify.js";

// Either direction of a block makes the pair invisible to each other
export const isBlockedEitherWay = async (a, b) => {
  const users = await User.find({
    $or: [
      { _id: a, blocked: b },
      { _id: b, blocked: a },
    ],
  }).select("_id");
  return users.length > 0;
};

// Stage 2 (see MIGRATION.md): reads come from the Follow collection; the
// embedded arrays are still dual-written as the rollback path.
export const getFollowerIds = async (userId) =>
  (await Follow.find({ following: userId }).select("follower").lean()).map(
    (e) => e.follower
  );
export const getFollowingIds = async (userId) =>
  (await Follow.find({ follower: userId }).select("following").lean()).map(
    (e) => e.following
  );

//register Controller
export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    //Validate the data — require plain strings (guards NoSQL-injection payloads)
    if (typeof username !== "string" || typeof email !== "string" || typeof password !== "string" ||
      !username.trim() || !email.trim() || !password) {
      return res.status(400).json({
        message: "All fields are required",
        success: false,
      });
    }
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username.trim())) {
      return res.status(400).json({
        message: "Username must be 3-30 characters (letters, numbers, . _ -)",
        success: false,
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({
        message: "Please enter a valid email address",
        success: false,
      });
    }
    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters",
        success: false,
      });
    }

    //check if username or email already used
    const existingUser = await User.findOne({
      $or: [{ username: username.trim() }, { email: email.trim() }],
    });
    if (existingUser) {
      const field = existingUser.username === username.trim() ? "Username" : "Email";
      return res.status(409).json({
        message: `${field} already exists! Try another one`,
        success: false,
      });
    }
    //Hash the password for security
    const hashedPassword = await bcrypt.hash(password, 10);
    //Create a new user
    await User.create({
      username: username.trim(),
      email: email.trim(),
      password: hashedPassword,
    });
    return res.status(201).json({
      message: "User created successfully",
      success: true,
    });
  } catch (error) {
    // Unique-index race: two concurrent registers can both pass the
    // existingUser check; the loser's insert fires E11000.
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "Account";
      return res.status(409).json({
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists! Try another one`,
        success: false,
      });
    }
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//Login Controller
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    //Validate the data — require plain strings (guards NoSQL-injection payloads)
    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return res.status(400).json({
        message: "All fields are required",
        success: false,
      });
    }
    //Check if the user is exists
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }
    // Compare the user Password
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        message: "Incorrect Email or Password",
        success: false,
      });
    }

    // Single query instead of one findById per post (N+1). Social graph is
    // read from the Follow collection (Stage 2).
    const [populatedPosts, followers, following] = await Promise.all([
      Post.find({ author: user._id })
        .sort({ _id: -1 })
        .populate({ path: "author", select: "username profilePicture" }),
      getFollowerIds(user._id),
      getFollowingIds(user._id),
    ]);

    user = {
      _id: user._id,
      username: user.username,
      email: user.email,
      profilePicture: user.profilePicture,
      bio: user.bio,
      followers,
      following,
      posts: populatedPosts,
      bookmarks: user.bookmarks,
    };
    // Generate the jwt token
    const token = await jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });
    return res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 1 * 24 * 60 * 60 * 1000,
      })
      .json({
        message: `Welcome back ${user.username}`,
        success: true,
        user,
      });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//Logout Controller
export const logout = async (req, res) => {
  try {
    return res.cookie("token", "", { maxAge: 0 }).json({
      message: "Logged out successfully.",
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//get user profile Controller
export const getProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    const isOwnProfile = userId === req.id;
    // Email is private — only returned on your own profile. Follower data
    // comes from the Follow collection (Stage 2) as counts, not arrays.
    let query = User.findById(userId)
      .populate({
        path: "posts",
        options: { sort: { createdAt: -1 } },
      })
      .select(isOwnProfile ? "-password" : "-password -email");
    // Bookmarks are private — only include them on your own profile
    if (isOwnProfile) query = query.populate("bookmarks");
    const user = await query;
    if (user && !isOwnProfile) user.bookmarks = undefined;
    // Blocked either way → the profile does not exist for this viewer
    if (user && !isOwnProfile && req.id && (await isBlockedEitherWay(req.id, userId))) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    let payload = user;
    if (user) {
      const [followersCount, followingCount] = await Promise.all([
        Follow.countDocuments({ following: user._id }),
        Follow.countDocuments({ follower: user._id }),
      ]);
      payload = { ...user.toObject(), followersCount, followingCount };
      // Private accounts hide their posts from non-followers
      if (user.isPrivate && !isOwnProfile) {
        const isFollower = req.id
          ? Boolean(await Follow.exists({ follower: req.id, following: userId }))
          : false;
        if (!isFollower) {
          payload.postsCount = payload.posts?.length ?? 0;
          payload.posts = [];
          payload.restricted = true;
          payload.requestedByMe = req.id
            ? Boolean(await FollowRequest.exists({ from: req.id, to: userId }))
            : false;
        }
      }
    }
    return res.status(200).json({
      user: payload,
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
//get user profile Controller
export const searchProfile = async (req, res) => {
  try {
    const username = req.params.id;
    const user = await User.findOne({ username: username })
      .populate({
        path: "posts",
        options: { sort: { createdAt: -1 } },
      })
      .select("-password -email");
    // Bookmarks are private — never exposed via username search
    if (user && user._id.toString() !== req.id) user.bookmarks = undefined;
    let payload = user;
    if (user) {
      const isOwn = user._id.toString() === req.id;
      if (!isOwn && req.id && (await isBlockedEitherWay(req.id, user._id))) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      const [followersCount, followingCount] = await Promise.all([
        Follow.countDocuments({ following: user._id }),
        Follow.countDocuments({ follower: user._id }),
      ]);
      payload = { ...user.toObject(), followersCount, followingCount };
      if (user.isPrivate && !isOwn) {
        const isFollower = req.id
          ? Boolean(await Follow.exists({ follower: req.id, following: user._id }))
          : false;
        if (!isFollower) {
          payload.postsCount = payload.posts?.length ?? 0;
          payload.posts = [];
          payload.restricted = true;
        }
      }
    }
    return res.status(200).json({
      user: payload,
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//Edit profile Controller
export const editProfile = async (req, res) => {
  try {
    const userId = req.id;
    const { bio, gender } = req.body;
    if (bio !== undefined && (typeof bio !== "string" || bio.length > 300)) {
      return res.status(400).json({
        message: "Bio must be a string of at most 300 characters",
        success: false,
      });
    }
    if (gender !== undefined && !["", "male", "female", "other"].includes(gender)) {
      return res.status(400).json({
        message: "Invalid gender value",
        success: false,
      });
    }
    const profilePicture = req.file;
    let cloudResponse;
    if (profilePicture) {
      // Optimize avatars the same way post images are optimized
      const sharp = (await import("sharp")).default;
      const optimized = await sharp(profilePicture.buffer)
        .resize(400, 400, { fit: "cover" })
        .toFormat("jpeg", { quality: 85 })
        .toBuffer();
      const fileUri = `data:image/jpeg;base64,${optimized.toString("base64")}`;
      cloudResponse = await cloudinary.uploader.upload(fileUri);
    }
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }
    //Check the below in case it not work
    user.bio = bio || user.bio;
    user.gender = gender || user.gender;
    user.profilePicture = cloudResponse?.secure_url || user.profilePicture;

    //Save the changes in the database
    await user.save();
    return res.status(200).json({
      message: "Profile updated successfully",
      success: true,
      user,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get suggested User
export const getSuggestedUsers = async (req, res) => {
  try {
    // Following list from the Follow collection (Stage 2)
    const followingIds = await getFollowingIds(req.id);

    // Exclude the logged-in user and the users they are following.
    // Capped + minimal fields — this used to return every user in the DB
    // with all their arrays.
    const limit = Math.min(parseInt(req.query.limit, 10) || 8, 20);
    const suggestedUsers = await User.find({
      _id: { $nin: [...followingIds, req.id] },
    })
      .select("username profilePicture bio")
      .limit(limit);

    if (suggestedUsers.length === 0) {
      return res.status(404).json({
        message: "No suggested users found",
        success: false,
      });
    }

    return res.status(200).json({
      message: "Suggested users fetched successfully",
      success: true,
      users: suggestedUsers,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//follow and Unfollow Controller
export const followOrUnfollow = async (req, res) => {
  try {
    // Getting the user id whom the logged in user wants to follow Or Unfollow
    const userToFollowOrUnfollowId = req.params.id;
    // Logged in user id
    const userId = req.id;
    // Check if the user is trying to follow himself
    if (userId === userToFollowOrUnfollowId) {
      // console.log("You cannot follow yourself");
      return res.status(400).json({
        message: "You cannot follow yourself",
        success: false,
      });
    }
    // Find the user to follow and the logged in user
    const userToFollowOrUnfollow = await User.findById(
      userToFollowOrUnfollowId
    );
    const user = await User.findById(userId);
    if (!userToFollowOrUnfollow || !user) {
      // console.log("User not found");
      return res.status(400).json({
        message: "User not found",
        success: false,
      });
    }
    // Blocks (either direction) sever the relationship entirely
    if (await isBlockedEitherWay(userId, userToFollowOrUnfollowId)) {
      return res.status(403).json({
        message: "You cannot follow this user",
        success: false,
      });
    }
    // Stage 2: the Follow collection is the read source of truth
    const isFollowing = Boolean(
      await Follow.exists({
        follower: userId,
        following: userToFollowOrUnfollowId,
      })
    );
    // Private accounts: following goes through a request. A pending request
    // toggles off (cancel) on a second tap.
    if (!isFollowing && userToFollowOrUnfollow.isPrivate) {
      const pending = await FollowRequest.findOneAndDelete({
        from: userId,
        to: userToFollowOrUnfollowId,
      });
      if (pending) {
        return res.status(200).json({
          message: "Follow request canceled",
          type: "unrequested",
          success: true,
        });
      }
      await FollowRequest.updateOne(
        { from: userId, to: userToFollowOrUnfollowId },
        { $setOnInsert: { from: userId, to: userToFollowOrUnfollowId } },
        { upsert: true }
      );
      await notify({
        recipient: userToFollowOrUnfollowId,
        sender: userId,
        type: "follow_request",
        text: "requested to follow you",
      });
      return res.status(200).json({
        message: "Follow request sent",
        type: "requested",
        success: true,
      });
    }
    if (isFollowing) {
      // Stage 3 (MIGRATION.md): the Follow collection is the only store
      await Follow.deleteOne({
        follower: userId,
        following: userToFollowOrUnfollowId,
      });
      return res.status(200).json({
        message: "User unfollowed successfully",
        type: "unfollow",
        success: true,
      });
    } else {
      // Idempotent upsert on the unique {follower, following} index —
      // upsertedCount tells us whether this request actually created the
      // edge, so the notification fires exactly once even on double-taps.
      const result = await Follow.updateOne(
        { follower: userId, following: userToFollowOrUnfollowId },
        {
          $setOnInsert: {
            follower: userId,
            following: userToFollowOrUnfollowId,
          },
        },
        { upsert: true }
      );
      if (result.upsertedCount > 0) {
        // Persisted + realtime notification
        await notify({
          recipient: userToFollowOrUnfollowId,
          sender: userId,
          type: "follow",
          text: "started following you",
        });
      }
      return res.status(200).json({
        message: "User followed successfully",
        type: "follow",
        success: true,
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Shared by getFollowers/getFollowing: cursor-paginate the Follow collection
// (Stage 2 — no more unbounded populate on the embedded arrays).
const getFollowEdges = async (req, res, edgeField, populateField, responseKey) => {
  try {
    const userId = req.params.id;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }
    const userExists = await User.exists({ _id: userId });
    if (!userExists) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    const { cursor } = req.query;
    if (cursor && !mongoose.isValidObjectId(cursor)) {
      return res.status(400).json({ success: false, message: "Invalid cursor" });
    }
    const query = { [edgeField]: userId };
    if (cursor) query._id = { $lt: cursor };
    const edges = await Follow.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate(populateField, "username profilePicture bio");
    const hasMore = edges.length > limit;
    if (hasMore) edges.pop();
    return res.status(200).json({
      success: true,
      [responseKey]: edges.map((e) => e[populateField]).filter(Boolean),
      nextCursor: hasMore ? edges[edges.length - 1]._id : null,
      message: `${responseKey} fetched successfully`,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//getFollowers Controller
export const getFollowers = (req, res) =>
  getFollowEdges(req, res, "following", "follower", "followers");

//getFollowing Controller
export const getFollowing = (req, res) =>
  getFollowEdges(req, res, "follower", "following", "following");

// GET /api/v1/user/me — fresh identity for route guarding / session checks
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found", success: false });
    }
    // Social graph from the Follow collection (Stage 2)
    const [followers, following] = await Promise.all([
      getFollowerIds(user._id),
      getFollowingIds(user._id),
    ]);
    return res.status(200).json({
      success: true,
      user: { ...user.toObject(), followers, following },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /api/v1/user/search?q= — case-insensitive username prefix/substring search
export const searchUsers = async (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim();
    if (!q) return res.status(200).json({ success: true, users: [] });
    // Escape regex metacharacters from user input
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const users = await User.find({ username: { $regex: safe, $options: "i" } })
      .select("username profilePicture bio")
      .limit(10);
    return res.status(200).json({ success: true, users });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// Account settings & privacy
// ---------------------------------------------------------------------------

// POST /api/v1/user/password/change
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return res.status(400).json({ success: false, message: "Both passwords are required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
    }
    const user = await User.findById(req.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    return res.status(200).json({ success: true, message: "Password updated" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// PATCH /api/v1/user/privacy { isPrivate } — switching to public auto-accepts
// every pending follow request (IG behavior).
export const setPrivacy = async (req, res) => {
  try {
    const { isPrivate } = req.body;
    if (typeof isPrivate !== "boolean") {
      return res.status(400).json({ success: false, message: "isPrivate must be a boolean" });
    }
    await User.updateOne({ _id: req.id }, { $set: { isPrivate } });
    if (!isPrivate) {
      const pending = await FollowRequest.find({ to: req.id });
      for (const request of pending) {
        await acceptRequestInternal(request);
      }
    }
    return res.status(200).json({
      success: true,
      isPrivate,
      message: isPrivate ? "Your account is now private" : "Your account is now public",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Create the follow edge for an accepted request (Stage-2 collection write +
// dual-written arrays), delete the request, and notify the requester.
const acceptRequestInternal = async (request) => {
  await Follow.updateOne(
    { follower: request.from, following: request.to },
    { $setOnInsert: { follower: request.from, following: request.to } },
    { upsert: true }
  );
  await FollowRequest.deleteOne({ _id: request._id });
  await notify({
    recipient: request.from,
    sender: request.to,
    type: "follow",
    text: "accepted your follow request",
  });
};

// GET /api/v1/user/follow-requests — incoming requests, newest first
export const getFollowRequests = async (req, res) => {
  try {
    const requests = await FollowRequest.find({ to: req.id })
      .sort({ _id: -1 })
      .limit(100)
      .populate("from", "username profilePicture bio");
    return res.status(200).json({
      success: true,
      requests: requests
        .filter((r) => r.from)
        .map((r) => ({ _id: r._id, from: r.from, createdAt: r.createdAt })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST /api/v1/user/follow-requests/:id/accept
export const acceptFollowRequest = async (req, res) => {
  try {
    const request = await FollowRequest.findOne({ _id: req.params.id, to: req.id });
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }
    await acceptRequestInternal(request);
    return res.status(200).json({ success: true, message: "Follow request accepted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST /api/v1/user/follow-requests/:id/decline
export const declineFollowRequest = async (req, res) => {
  try {
    const request = await FollowRequest.findOneAndDelete({ _id: req.params.id, to: req.id });
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }
    return res.status(200).json({ success: true, message: "Follow request declined" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST /api/v1/user/block/:id — blocking severs the relationship both ways
export const blockUser = async (req, res) => {
  try {
    const targetId = req.params.id;
    if (!mongoose.isValidObjectId(targetId) || targetId === req.id) {
      return res.status(400).json({ success: false, message: "Invalid user" });
    }
    const target = await User.exists({ _id: targetId });
    if (!target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    await User.updateOne({ _id: req.id }, { $addToSet: { blocked: targetId } });
    // Remove every follow edge and pending request in both directions
    await Promise.all([
      Follow.deleteMany({
        $or: [
          { follower: req.id, following: targetId },
          { follower: targetId, following: req.id },
        ],
      }),
      FollowRequest.deleteMany({
        $or: [
          { from: req.id, to: targetId },
          { from: targetId, to: req.id },
        ],
      }),
    ]);
    return res.status(200).json({ success: true, message: "User blocked" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST /api/v1/user/unblock/:id
export const unblockUser = async (req, res) => {
  try {
    const targetId = req.params.id;
    if (!mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({ success: false, message: "Invalid user" });
    }
    await User.updateOne({ _id: req.id }, { $pull: { blocked: targetId } });
    return res.status(200).json({ success: true, message: "User unblocked" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /api/v1/user/blocked
export const getBlockedUsers = async (req, res) => {
  try {
    const user = await User.findById(req.id).populate(
      "blocked",
      "username profilePicture bio"
    );
    return res.status(200).json({ success: true, blocked: user?.blocked || [] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// DELETE /api/v1/user/account { password } — permanent, removes all user data
export const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body || {};
    if (typeof password !== "string") {
      return res.status(400).json({ success: false, message: "Password is required" });
    }
    const user = await User.findById(req.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
      return res.status(401).json({ success: false, message: "Password is incorrect" });
    }

    const userId = user._id;
    const posts = await Post.find({ author: userId }).select("_id image");
    const postIds = posts.map((p) => p._id);

    // Best-effort Cloudinary cleanup — never blocks the deletion
    for (const post of posts) {
      try {
        const publicId = post.image.split("/").pop().split(".")[0];
        if (publicId) await cloudinary.uploader.destroy(publicId);
      } catch (e) {
        console.error("Cloudinary cleanup failed:", e.message);
      }
    }

    await Promise.all([
      Post.deleteMany({ author: userId }),
      Comment.deleteMany({ $or: [{ author: userId }, { post: { $in: postIds } }] }),
      Like.deleteMany({ $or: [{ user: userId }, { post: { $in: postIds } }] }),
      Follow.deleteMany({ $or: [{ follower: userId }, { following: userId }] }),
      FollowRequest.deleteMany({ $or: [{ from: userId }, { to: userId }] }),
      Notification.deleteMany({ $or: [{ recipient: userId }, { sender: userId }] }),
      Story.deleteMany({ author: userId }),
      Message.deleteMany({ $or: [{ senderId: userId }, { recieverId: userId }] }),
      Conversation.deleteMany({ participants: userId }),
      PushSubscription.deleteMany({ user: userId }),
      User.updateMany({ blocked: userId }, { $pull: { blocked: userId } }),
      User.updateMany(
        { bookmarks: { $in: postIds } },
        { $pull: { bookmarks: { $in: postIds } } }
      ),
    ]);
    await User.deleteOne({ _id: userId });

    return res
      .cookie("token", "", { maxAge: 0 })
      .status(200)
      .json({ success: true, message: "Account deleted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
