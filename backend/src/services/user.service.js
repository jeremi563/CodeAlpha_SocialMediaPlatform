import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { Follow } from "../models/follow.model.js";
import { PAGINATION } from "../config/constants.js";

/**
 * User profile business logic: retrieval, updates, search,
 * post listing, follower/following lists and counts.
 */

/**
 * Gets a public profile by username.
 * Returns null if not found.
 */
export async function getPublicProfile(username) {
  return User.findOne({ username }).lean();
}

/**
 * Computes profile stats: post count, follower count, following count.
 * Runs three counts in parallel. All three are indexed lookups.
 */
export async function getProfileStats(userId) {
  const [postCount, followerCount, followingCount] = await Promise.all([
    Post.countDocuments({ author: userId }),
    Follow.countDocuments({ following: userId }), // people who follow me
    Follow.countDocuments({ follower: userId }),  // people I follow
  ]);

  return { postCount, followerCount, followingCount };
}

/**
 * Updates the current user's profile.
 * Enforces uniqueness of the new username at the application layer,
 * and relies on the unique index as the final guard (race conditions).
 */
export async function updateProfile(userId, updates) {
  const allowed = ["fullName", "username", "bio"];
  const filtered = {};

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      filtered[key] = updates[key];
    }
  }

  // Check username uniqueness if it's being changed
  if (filtered.username) {
    const conflict = await User.findOne({
      username: filtered.username,
      _id: { $ne: userId },
    }).lean();

    if (conflict) {
      const err = new Error("Username is already taken.");
      err.code = "DUPLICATE";
      err.status = 409;
      throw err;
    }
  }

  try {
    const updated = await User.findByIdAndUpdate(userId, filtered, {
      new: true,           // return the updated document
      runValidators: true, // apply schema validators to the update
    });
    return updated;
  } catch (err) {
    if (err.code === 11000) {
      const dupErr = new Error("Username is already taken.");
      dupErr.code = "DUPLICATE";
      dupErr.status = 409;
      throw dupErr;
    }
    throw err;
  }
}

/**
 * Searches users by username prefix (case-insensitive).
 * Returns a small, safe projection of public info.
 */
export async function searchUsers(query, limit = 10) {
  // Escape regex metacharacters so a query like "a.b" doesn't
  // behave like a pattern. Section 12.3.
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp("^" + escaped, "i");

  return User.find({ username: regex })
    .select("fullName username bio")
    .limit(limit)
    .lean();
}

/**
 * Lists a user's posts with pagination, newest first.
 * Mirrors the feed shape but scoped to one author.
 */
export async function getUserPosts(userId, { page, limit }) {
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    Post.find({ author: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "fullName username")
      .lean(),
    Post.countDocuments({ author: userId }),
  ]);

  return { posts, total };
}

/**
 * Lists followers of a user (people who follow :username).
 * Returns public user info of the *follower* side.
 */
export async function getFollowers(userId, { page, limit }) {
  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    Follow.find({ following: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("follower", "fullName username bio")
      .lean(),
    Follow.countDocuments({ following: userId }),
  ]);

  return { users: rows.map((r) => r.follower), total };
}

/**
 * Lists accounts a user follows (the "following" list).
 * Returns public user info of the *following* side.
 */
export async function getFollowing(userId, { page, limit }) {
  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    Follow.find({ follower: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("following", "fullName username bio")
      .lean(),
    Follow.countDocuments({ follower: userId }),
  ]);

  return { users: rows.map((r) => r.following), total };
}

/**
 * Finds a user by username OR id. Used by controllers that need
 * to resolve a profile from either identifier.
 */
export async function findUserByIdentifierOrId(value) {
  if (mongoose.Types.ObjectId.isValid(value)) {
    return User.findById(value).lean();
  }
  return User.findOne({ username: value }).lean();
}