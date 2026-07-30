import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import getDataUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";
import { Post } from "../models/post.model.js";

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

    //populate each post if in the post array
    const populatedPosts = await Promise.all(
      user.posts.map(async (postId) => {
        const post = await Post.findById(postId).populate("author");
        if (post.author.equals(user._id)) {
          return post;
        }
        return null;
      })
    );

    user = {
      _id: user._id,
      username: user.username,
      email: user.email,
      profilePicture: user.profilePicture,
      bio: user.bio,
      followers: user.followers,
      following: user.following,
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
    const user = await User.findById(userId)
      .populate({
        path: "posts",
        createdAt: -1,
      })
      .populate("bookmarks")
      .select("-password");
    // console.log(user);
    return res.status(200).json({
      user,
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
        createdAt: -1,
      })
      .populate("bookmarks")
      .select("-password");
    // console.log(user);
    return res.status(200).json({
      user,
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
    const profilePicture = req.file;
    let cloudResponse;
    if (profilePicture) {
      const fileUri = getDataUri(profilePicture);
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
    // Fetch the logged-in user's following list
    const user = await User.findById(req.id).select("following");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }

    // Exclude the logged-in user and the users they are following
    const suggestedUsers = await User.find({
      _id: { $nin: [...user.following, req.id] },
    }).select("-password");

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
    const isFollowing = user.following.includes(userToFollowOrUnfollowId);
    if (isFollowing) {
      // Unfollow the user
      await User.findByIdAndUpdate(userId, {
        $pull: { following: userToFollowOrUnfollowId },
      });
      await User.findByIdAndUpdate(userToFollowOrUnfollowId, {
        $pull: { followers: userId },
      });
      // console.log("User unfollowed successfully");
      return res.status(200).json({
        message: "User unfollowed successfully",
        type: "unfollow",
        success: true,
      });
    } else {
      // Follow the user
      await User.findByIdAndUpdate(userId, {
        $push: { following: userToFollowOrUnfollowId },
      });
      await User.findByIdAndUpdate(userToFollowOrUnfollowId, {
        $push: { followers: userId },
      });
      // console.log("User followed successfully");
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

//getFollowers Controller
export const getFollowers = async (req, res) => {
  try {
    // user id of user
    const userId = req.params.id;
    // Fetch the user document to get the followers and following
    const user = await User.findById(userId)
      .populate("followers", "username profilePicture bio")
      .exec();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Send the followers and following data as response
    return res.status(200).json({
      success: true,
      followers: user.followers,
      message: "Following fetched successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//getFollowing Controller
export const getFollowing = async (req, res) => {
  try {
    // user id of user
    const userId = req.params.id;
    // Fetch the user document to get the followers and following
    const user = await User.findById(userId)
      .populate("following", "username profilePicture bio")
      .exec();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    // console.log("Following fetched successfully:", user.following);
    // Send the followers and following data as response
    return res.status(200).json({
      success: true,
      following: user.following,
      message: "Following fetched successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
