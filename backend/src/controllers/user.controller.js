import { validationResult } from "express-validator";
import * as userService from "../services/user.service.js";
import { PAGINATION } from "../config/constants.js";
import * as followService from "../services/follow.service.js";
import * as profilePictureService from "../services/profile-picture.service.js";
import sharp from "sharp";

/**
 * Strips any fields that should never appear in a public response,
 * for the .lean() code path (where the model's toJSON transform
 * does not run).
 */
function toPublicUser(doc) {
  if (!doc) return null;
  const { _id, passwordHash, email, profilePictureId, role, isActive, __v, ...rest } = doc;
  const result = { id: _id.toString(), ...rest };
  if (profilePictureId) {
    result.avatarUrl = `/api/users/${encodeURIComponent(result.username)}/avatar/${profilePictureId}`;
  }
  return result;
}

export async function uploadProfilePicture(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Choose an image to upload." });
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(req.file.mimetype)) {
      return res.status(415).json({
        success: false,
        message: "Profile pictures must be JPEG, PNG, or WebP images.",
      });
    }

    const image = sharp(req.file.buffer, { limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format)) {
      return res.status(415).json({
        success: false,
        message: "Profile pictures must be JPEG, PNG, or WebP images.",
      });
    }

    const normalized = await image
      .rotate()
      .resize(512, 512, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();
    const user = await profilePictureService.saveProfilePicture(req.userId, normalized);

    return res.status(200).json({
      success: true,
      message: "Profile picture updated.",
      data: { avatarUrl: user.toJSON().avatarUrl },
    });
  } catch (err) {
    if (err.message?.includes("Input buffer")) {
      return res.status(400).json({ success: false, message: "The uploaded file is not a valid image." });
    }
    if (err.message?.includes("pixel limit")) {
      return res.status(400).json({ success: false, message: "The image dimensions are too large." });
    }
    next(err);
  }
}

export async function deleteProfilePicture(req, res, next) {
  try {
    const removed = await profilePictureService.removeProfilePicture(req.userId);
    if (!removed) return res.status(404).json({ success: false, message: "User not found." });
    return res.status(200).json({ success: true, message: "Profile picture removed." });
  } catch (err) {
    next(err);
  }
}

export async function getProfilePicture(req, res, next) {
  try {
    const user = await userService.getPublicProfile(req.params.username);
    if (!user || !user.profilePictureId || user.profilePictureId.toString() !== req.params.pictureId) {
      return res.status(404).json({ success: false, message: "Profile picture not found." });
    }

    const picture = await profilePictureService.openProfilePicture(req.params.pictureId);
    if (!picture) return res.status(404).json({ success: false, message: "Profile picture not found." });

    res.set({
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    });
    picture.stream.on("error", (err) => {
      if (res.headersSent) res.destroy(err);
      else next(err);
    });
    picture.stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/users/search?q=...
 * Auth: required (Section 9.2)
 */
export async function searchUsers(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }

    const users = await userService.searchUsers(req.query.q, 10);
    return res.status(200).json({
      success: true,
      data: { users: users.map(toPublicUser) },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/users/:username
 * Public — no authentication required.
 * Includes post/follower/following counts (Section 9.2).
 */
export async function getProfile(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }

    const user = await userService.getPublicProfile(req.params.username);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const stats = await userService.getProfileStats(user._id);

    const isFollowing = req.userId
      ? await followService.isFollowing(req.userId, user._id)
      : false;

    return res.status(200).json({
      success: true,
      data: {
        user: toPublicUser(user),
        stats:{ ...stats, isFollowing },
        
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/users/me
 * Auth: required.
 * Editable: fullName, username, bio (Section 9.2).
 */
export async function updateMe(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }

    const updated = await userService.updateProfile(req.userId, req.body);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data: { user: updated.toJSON() },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/users/me
 * Auth: required.
 * Permanently deletes the authenticated user's account and all
 * associated data (posts, comments, likes, follows, notifications,
 * profile picture). Requires the current password for confirmation.
 * Section 5.10.
 */
export async function deleteAccount(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }

    const deleted = await userService.deleteAccount(req.userId, req.body.password);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Destroy the session so the user is logged out after deletion.
    if (req.session) {
      return req.session.destroy((err) => {
        if (err) return next(err);
        res.clearCookie("smp.sid");
        return res.status(200).json({
          success: true,
          message: "Your account and all associated data have been permanently deleted.",
        });
      });
    }

    return res.status(200).json({
      success: true,
      message: "Your account and all associated data have been permanently deleted.",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/users/:username/posts?page=&limit=
 * Public. Paginated list of a user's posts.
 */
export async function getUserPosts(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }

    const user = await userService.getPublicProfile(req.params.username);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const page = req.query.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = req.query.limit ?? PAGINATION.DEFAULT_LIMIT;

    const { posts, total } = await userService.getUserPosts(user._id, { page, limit });

    return res.status(200).json({
      success: true,
      data: {
        posts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/users/:username/followers?page=&limit=
 * Public. Paginated list of users who follow :username.
 */
export async function getFollowers(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }

    const user = await userService.getPublicProfile(req.params.username);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const page = req.query.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = req.query.limit ?? PAGINATION.DEFAULT_LIMIT;

    const { users, total } = await userService.getFollowers(user._id, { page, limit });

    return res.status(200).json({
      success: true,
      data: {
        users: users.map(toPublicUser),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/users/:username/following?page=&limit=
 * Public. Paginated list of users that :username follows.
 */
export async function getFollowing(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }

    const user = await userService.getPublicProfile(req.params.username);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const page = req.query.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = req.query.limit ?? PAGINATION.DEFAULT_LIMIT;

    const { users, total } = await userService.getFollowing(user._id, { page, limit });

    return res.status(200).json({
      success: true,
      data: {
        users: users.map(toPublicUser),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      },
    });
  } catch (err) {
    next(err);
  }
}