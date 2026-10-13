import { body, query, param } from "express-validator";
import { LIMITS, USERNAME_REGEX } from "../config/constants.js";

/**
 * Validation chains for user profile endpoints.
 */

/**
 * PATCH /api/users/me
 * All fields optional — the user may update just one.
 * At least one editable field must be present.
 */
export const updateProfileValidator = [
  body("fullName")
    .optional()
    .trim()
    .notEmpty().withMessage("Full name cannot be empty.")
    .isLength({ max: LIMITS.FULL_NAME_MAX })
    .withMessage(`Full name cannot exceed ${LIMITS.FULL_NAME_MAX} characters.`),

  body("username")
    .optional()
    .trim()
    .toLowerCase()
    .matches(USERNAME_REGEX)
    .withMessage(
      `Username must be ${LIMITS.USERNAME_MIN}-${LIMITS.USERNAME_MAX} characters and may only contain lowercase letters, numbers, and underscores.`
    ),

  body("bio")
    .optional()
    .trim()
    .isLength({ max: LIMITS.BIO_MAX })
    .withMessage(`Bio cannot exceed ${LIMITS.BIO_MAX} characters.`),

  body()
    .custom((value, { req }) => {
      const editable = ["fullName", "username", "bio"];
      const hasOne = editable.some((field) =>
        Object.prototype.hasOwnProperty.call(req.body, field)
      );
      if (!hasOne) {
        throw new Error("At least one editable field is required.");
      }
      return true;
    }),
];

/**
 * GET /api/users/search?q=...
 */
export const searchUsersValidator = [
  query("q")
    .trim()
    .notEmpty().withMessage("Search query is required.")
    .isLength({ min: 1, max: 50 })
    .withMessage("Search query must be between 1 and 50 characters."),
];

/**
 * GET /api/users/:username, /:username/posts, etc.
 * Validates the username param against the same format we enforce on accounts.
 */
export const usernameParamValidator = [
  param("username")
    .trim()
    .toLowerCase()
    .matches(USERNAME_REGEX)
    .withMessage("Invalid username format."),
];

/**
 * Reusable pagination validation for query parameters.
 * Used by posts/followers/following lists now and later by the feed.
 */
export const paginationValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be a positive integer.")
    .toInt(),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("limit must be between 1 and 50.")
    .toInt(),
];