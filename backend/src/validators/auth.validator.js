import { body } from "express-validator";
import { LIMITS, USERNAME_REGEX } from "../config/constants.js";

/**
 * Validation chains for authentication endpoints.
 * Each exports an array of express-validator middlewares.
 */

export const registerValidator = [
  body("fullName")
    .trim()
    .notEmpty().withMessage("Full name is required.")
    .isLength({ max: LIMITS.FULL_NAME_MAX })
    .withMessage(`Full name cannot exceed ${LIMITS.FULL_NAME_MAX} characters.`),

  body("username")
    .trim()
    .toLowerCase()
    .notEmpty().withMessage("Username is required.")
    .matches(USERNAME_REGEX)
    .withMessage(
      `Username must be ${LIMITS.USERNAME_MIN}-${LIMITS.USERNAME_MAX} characters and may only contain lowercase letters, numbers, and underscores.`
    ),

  body("email")
    .trim()
    .toLowerCase()
    .notEmpty().withMessage("Email is required.")
    .isEmail().withMessage("Please provide a valid email address.")
    .normalizeEmail({ gmail_remove_dots: false }), // don't silently alter gmail addresses

  body("password")
    .isString().withMessage("Password must be a string.")
    .isLength({ min: LIMITS.PASSWORD_MIN, max: LIMITS.PASSWORD_MAX })
    .withMessage(
      `Password must be between ${LIMITS.PASSWORD_MIN} and ${LIMITS.PASSWORD_MAX} characters.`
    ),
];

export const loginValidator = [
  body("identifier")
    .trim()
    .notEmpty().withMessage("Username or email is required."),

  body("password")
    .isString().withMessage("Password must be a string.")
    .notEmpty().withMessage("Password is required."),
];