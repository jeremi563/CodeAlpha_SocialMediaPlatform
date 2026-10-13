import { body, param } from "express-validator";
import { LIMITS } from "../config/constants.js";

/**
 * Validation chains for comment endpoints (Section 9.4).
 */

export const createCommentValidator = [
  body("content")
    .isString().withMessage("Comment content must be a string.")
    .trim()
    .notEmpty().withMessage("Comment content is required.")
    .isLength({ max: LIMITS.COMMENT_CONTENT_MAX })
    .withMessage(`Comment cannot exceed ${LIMITS.COMMENT_CONTENT_MAX} characters.`),
];

export const updateCommentValidator = [
  body("content")
    .isString().withMessage("Comment content must be a string.")
    .trim()
    .notEmpty().withMessage("Comment content is required.")
    .isLength({ max: LIMITS.COMMENT_CONTENT_MAX })
    .withMessage(`Comment cannot exceed ${LIMITS.COMMENT_CONTENT_MAX} characters.`),
];

export const commentIdParamValidator = [
  param("commentId")
    .isMongoId().withMessage("Invalid comment id."),
];