import { validationResult } from "express-validator";
import * as postService from "../services/post.service.js";
import { PAGINATION } from "../config/constants.js";

/**
 * Helper: pull validated pagination with defaults.
 */
function readPagination(req) {
  return {
    page: req.query.page ?? PAGINATION.DEFAULT_PAGE,
    limit: req.query.limit ?? PAGINATION.DEFAULT_LIMIT,
  };
}

/**
 * Helper: standardized validation-error response.
 */
function sendValidationErrors(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed.",
    errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
  });
}

/**
 * POST /api/posts
 * Auth: required.
 */
export async function createPost(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);

    const post = await postService.createPost({
      authorId: req.userId,
      content: req.body.content,
    });

    return res.status(201).json({
      success: true,
      message: "Post created successfully.",
      data: { post: post.toJSON() },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/posts?page=&limit=
 * Optional auth — flag likedByMe when a session is present.
 */
export async function getFeed(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);

    const { page, limit } = readPagination(req);
    const { posts, total } = await postService.getFeed({
      page,
      limit,
      currentUserId: req.userId ?? null,
    });

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
 * GET /api/posts/:postId
 * Optional auth.
 */
export async function getPost(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);

    const post = await postService.getPostById(req.params.postId, req.userId ?? null);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    return res.status(200).json({ success: true, data: { post } });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/posts/:postId
 * Auth: required + ownership.
 */
export async function updatePost(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);

    const updated = await postService.updatePost(
      req.params.postId,
      req.userId,
      req.body.content
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Post updated successfully.",
      data: { post: updated },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/posts/:postId
 * Auth: required + ownership. Cascades to comments/likes.
 */
export async function deletePost(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);

    const deleted = await postService.deletePost(req.params.postId, req.userId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Post deleted successfully.",
    });
  } catch (err) {
    next(err);
  }
}