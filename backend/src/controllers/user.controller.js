import { validationResult } from "express-validator";
import * as userService from "../services/user.service.js";
import { PAGINATION } from "../config/constants.js";
import * as followService from "../services/follow.service.js";

/**
 * Strips any fields that should never appear in a public response,
 * for the .lean() code path (where the model's toJSON transform
 * does not run).
 */
function toPublicUser(doc) {
  if (!doc) return null;
  const { _id, passwordHash, __v, ...rest } = doc;
  return { id: _id.toString(), ...rest };
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