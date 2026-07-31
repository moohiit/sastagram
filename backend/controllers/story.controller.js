import sharp from "sharp";
import cloudinary from "../utils/cloudinary.js";
import { Story } from "../models/story.model.js";
import { User } from "../models/user.model.js";

// Add new Story controller
export const addNewStory = async (req, res) => {
  try {
    const image = req.file;
    const authorId = req.id;
    if (!image) {
      return res.status(400).json({
        message: "Image required",
        success: false,
      });
    }
    const optimizedImageBuffer = await sharp(image.buffer)
      .resize({
        width: 1080,
        height: 1920,
        fit: "inside",
      })
      .toFormat("jpeg", { quality: 80 })
      .toBuffer();
    // Image to data uri
    const imageUri = `data:${
      image.mimetype
    };base64,${optimizedImageBuffer.toString("base64")}`;
    // Upload image to cloudinary
    const cloudResponse = await cloudinary.uploader.upload(imageUri);
    if (!cloudResponse) {
      return res.status(500).json({
        message: "Error uploading image to cloudinary",
        success: false,
      });
    }
    // Create the story
    const story = await Story.create({
      image: cloudResponse.secure_url,
      author: authorId,
    });
    await story.populate({
      path: "author",
      select: "username profilePicture",
    });
    return res.status(201).json({
      message: "Story added successfully",
      success: true,
      story,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Stories feed controller — stories from users I follow + my own, grouped by
// author: my own group first, then groups with unseen stories, then all-seen.
export const getStoriesFeed = async (req, res) => {
  try {
    const userId = req.id;
    const me = await User.findById(userId).select("following");
    if (!me) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }

    // TTL removes expired docs, but the monitor only runs ~every 60s —
    // filter by createdAt defensively as well.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stories = await Story.find({
      author: { $in: [...me.following, userId] },
      createdAt: { $gt: since },
    })
      .sort({ createdAt: 1 })
      .populate({
        path: "author",
        select: "username profilePicture",
      });

    // Group by author, preserving chronological order within a group
    const groupsByAuthor = new Map();
    for (const story of stories) {
      const authorId = story.author._id.toString();
      if (!groupsByAuthor.has(authorId)) {
        groupsByAuthor.set(authorId, {
          user: {
            _id: story.author._id,
            username: story.author.username,
            profilePicture: story.author.profilePicture,
          },
          stories: [],
          allSeen: true,
        });
      }
      const group = groupsByAuthor.get(authorId);
      const seen = story.seenBy.some((id) => id.toString() === userId);
      if (!seen) group.allSeen = false;
      group.stories.push({
        _id: story._id,
        image: story.image,
        createdAt: story.createdAt,
        seen,
      });
    }

    // Ordering: my own group first, then unseen groups, then seen groups
    const mine = [];
    const unseen = [];
    const seenGroups = [];
    for (const [authorId, group] of groupsByAuthor) {
      if (authorId === userId) mine.push(group);
      else if (!group.allSeen) unseen.push(group);
      else seenGroups.push(group);
    }

    return res.status(200).json({
      message: "Stories fetched successfully",
      success: true,
      groups: [...mine, ...unseen, ...seenGroups],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Mark a story as seen controller
export const markStorySeen = async (req, res) => {
  try {
    const storyId = req.params.id;
    const userId = req.id;
    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({
        message: "Story not found",
        success: false,
      });
    }
    // Atomic — no extra save needed
    await story.updateOne({ $addToSet: { seenBy: userId } });
    return res.status(200).json({
      message: "Story marked as seen",
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

// Delete a story controller (author only)
export const deleteStory = async (req, res) => {
  try {
    const storyId = req.params.id;
    const authorId = req.id;
    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({
        message: "Story not found",
        success: false,
      });
    }
    if (story.author.toString() !== authorId) {
      return res.status(403).json({
        message: "You are not authorized to delete this story",
        success: false,
      });
    }

    await Story.findByIdAndDelete(storyId);

    // Delete the image from Cloudinary (public_id = last URL segment sans extension)
    try {
      const publicId = story.image.split("/").pop().split(".")[0];
      if (publicId) await cloudinary.uploader.destroy(publicId);
    } catch (e) {
      console.error("Cloudinary cleanup failed:", e.message);
    }

    return res.status(200).json({
      message: "Story deleted successfully",
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error deleting story",
      success: false,
    });
  }
};
