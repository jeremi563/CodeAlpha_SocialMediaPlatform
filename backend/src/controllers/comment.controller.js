import { validationResult } from "express-validator";
import * as commentService from "../services/comment.service.js";
import { PAGINATION } from "../config/constants.js";

function sendValidationErrors(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed.",
    errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
  });
}

function readPagination(req) {
  return {
    page: req.query.page ?? PAGINATION.DEFAULT_PAGE,
    limit: req.query.limit ?? PAGINATION.DEFAULT_LIMIT,
  };
}

/**
 * POST /api/posts/:postId/comments
 * Auth: required (Section 9.4).
 */
export async function createComment(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);

    const comment = await commentService.createComment({
      postId: req.params.postId,
      authorId: req.userId,
      content: req.body.content,
    });

    return res.status(201).json({
      success: true,
      message: "Comment added successfully.",
      data: { comment: comment.toJSON() },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/posts/:postId/comments?page=&limit=
 * Public — no auth required to read comments.
 */
export async function getPostComments(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);

    const { page, limit } = readPagination(req);
    const { comments, total } = await commentService.getPostComments(
      req.params.postId,
      { page, limit }
    );

    return res.status(200).json({
      success: true,
      data: {
        comments,
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
 * PATCH /api/comments/:commentId
 * Auth: required + ownership (Section 9.4).
 */
export async function updateComment(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);

    const updated = await commentService.updateComment(
      req.params.commentId,
      req.userId,
      req.body.content
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Comment not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Comment updated successfully.",
      data: { comment: updated.toJSON() },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/comments/:commentId
 * Auth: required + ownership.
 */
export async function deleteComment(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);

    const deleted = await commentService.deleteComment(
      req.params.commentId,
      req.userId
    );

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Comment not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Comment deleted successfully.",
    });
  } catch (err) {
    next(err);
  }
}