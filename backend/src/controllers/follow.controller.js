import { validationResult } from "express-validator";
import * as followService from "../services/follow.service.js";

function sendValidationErrors(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed.",
    errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
  });
}

/**
 * POST /api/users/:userId/follow
 * Auth: required (Section 9.6).
 * Idempotent — 201 on new follow, 200 if already following.
 */
export async function followUser(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);

    const { created } = await followService.followUser(
      req.userId,               // follower: from session
      req.params.userId         // following: from URL
    );

    const state = await followService.getFollowState(
      req.userId,
      req.params.userId
    );

    return res.status(created ? 201 : 200).json({
      success: true,
      message: created ? "User followed." : "Already following this user.",
      data: state,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/users/:userId/follow
 * Auth: required. Idempotent.
 */
export async function unfollowUser(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);

    const { deleted } = await followService.unfollowUser(
      req.userId,
      req.params.userId
    );

    const state = await followService.getFollowState(
      req.userId,
      req.params.userId
    );

    return res.status(200).json({
      success: true,
      message: deleted ? "User unfollowed." : "You were not following this user.",
      data: state,
    });
  } catch (err) {
    next(err);
  }
}