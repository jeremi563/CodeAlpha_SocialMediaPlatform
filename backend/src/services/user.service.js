import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { Follow } from "../models/follow.model.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { Notification } from "../models/notification.model.js";
import * as profilePictureService from "./profile-picture.service.js";
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
    .select("fullName username bio profilePictureId")
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
      .populate("author", "fullName username profilePictureId")
      .lean(),
    Post.countDocuments({ author: userId }),
  ]);

  return {
    posts: posts.map((post) => ({ ...post, author: publicAuthor(post.author) })),
    total,
  };
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
      .populate("follower", "fullName username bio profilePictureId")
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
      .populate("following", "fullName username bio profilePictureId")
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

/**
 * Permanently deletes a user account and all associated data.
 *
 * Cascade order (Section 5.10):
 *   1. Delete the user's profile picture from GridFS (best-effort).
 *   2. Delete all posts authored by the user — this cascades to
 *      their comments and likes via post.service.deletePost semantics.
 *   3. Delete comments authored by the user on OTHER users' posts.
 *   4. Delete likes created by the user.
 *   5. Delete follow relationships where the user is follower OR following.
 *   6. Delete notifications where the user is recipient OR actor.
 *   7. Delete the user document itself.
 *
 * The password is verified before any deletion occurs so that
 * an accidental or malicious request cannot wipe an account.
 *
 * Returns true if the user was found and deleted, false if not found.
 * Throws with status 403 if the password does not match.
 */
export async function deleteAccount(userId, password) {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) return false;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const err = new Error("Incorrect password.");
    err.status = 403;
    throw err;
  }

  const id = user._id;

  // 1. Remove profile picture from GridFS (best-effort — never block deletion).
  if (user.profilePictureId) {
    await profilePictureService.removeProfilePicture(userId).catch((err) => {
      console.error("[account] Failed to remove profile picture during deletion:", err.message);
    });
  }

  // 2. Delete all posts authored by this user.
  //    Each post deletion also removes its comments, likes, and notifications.
  const userPosts = await Post.find({ author: id }).select("_id");
  for (const post of userPosts) {
    await Post.deleteOne({ _id: post._id });
    await Promise.all([
      Comment.deleteMany({ post: post._id }),
      Like.deleteMany({ post: post._id }),
      Notification.deleteMany({ post: post._id }),
    ]);
  }

  // 3. Delete comments authored by the user on other posts.
  await Comment.deleteMany({ author: id });

  // 4. Delete likes created by the user.
  await Like.deleteMany({ user: id });

  // 5. Delete follow relationships involving this user (both directions).
  await Follow.deleteMany({
    $or: [{ follower: id }, { following: id }],
  });

  // 6. Delete notifications where the user is recipient or actor.
  await Notification.deleteMany({
    $or: [{ recipient: id }, { actor: id }],
  });

  // 7. Finally, delete the user document.
  await User.deleteOne({ _id: id });

  return true;
}

function publicAuthor(author) {
  if (!author) return null;
  const result = {
    id: author._id.toString(),
    fullName: author.fullName,
    username: author.username,
  };
  if (author.profilePictureId) {
    result.avatarUrl = `/api/users/${encodeURIComponent(author.username)}/avatar/${author.profilePictureId}`;
  }
  return result;
}