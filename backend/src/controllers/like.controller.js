import { validationResult } from "express-validator";
import * as likeService from "../services/like.service.js";

function sendValidationErrors(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed.",
    errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
  });
}

/**
 * POST /api/posts/:postId/likes
 * Auth: required (Section 9.5).
 * Idempotent — returns 201 on new like, 200 if already liked.
 */
export async function likePost(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);

    const { created } = await likeService.likePost(req.params.postId, req.userId);
    const state = await likeService.getPostLikeState(req.params.postId, req.userId);

    return res.status(created ? 201 : 200).json({
      success: true,
      message: created ? "Post liked." : "Post already liked.",
      data: state,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/posts/:postId/likes
 * Auth: required. Idempotent.
 */
export async function unlikePost(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);

    const { deleted } = await likeService.unlikePost(req.params.postId, req.userId);
    const state = await likeService.getPostLikeState(req.params.postId, req.userId);

    return res.status(200).json({
      success: true,
      message: deleted ? "Post unliked." : "Post was not liked.",
      data: state,
    });
  } catch (err) {
    next(err);
  }
}