import { body, param } from "express-validator";
import { LIMITS } from "../config/constants.js";

/**
 * Validation chains for post endpoints (Section 9.3).
 */

export const createPostValidator = [
  body("content")
    .isString().withMessage("Post content must be a string.")
    .trim()
    .notEmpty().withMessage("Post content is required.")
    .isLength({ max: LIMITS.POST_CONTENT_MAX })
    .withMessage(`Post content cannot exceed ${LIMITS.POST_CONTENT_MAX} characters.`),
];

export const updatePostValidator = [
  body("content")
    .isString().withMessage("Post content must be a string.")
    .trim()
    .notEmpty().withMessage("Post content is required.")
    .isLength({ max: LIMITS.POST_CONTENT_MAX })
    .withMessage(`Post content cannot exceed ${LIMITS.POST_CONTENT_MAX} characters.`),
];

/**
 * Validates the :postId param is a well-formed MongoDB ObjectId
 * before any DB call. Prevents Mongoose CastError -> 500 leaking
 * as generic errors (Section 12.2).
 */
export const postIdParamValidator = [
  param("postId")
    .isMongoId().withMessage("Invalid post id."),
];