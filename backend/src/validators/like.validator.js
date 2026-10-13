import { param } from "express-validator";

/**
 * Like/Unlike endpoints only carry a :postId param.
 * The user identity always comes from the session.
 */
export const likePostIdValidator = [
  param("postId")
    .isMongoId().withMessage("Invalid post id."),
];