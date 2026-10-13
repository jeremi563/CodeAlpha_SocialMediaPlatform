import { param } from "express-validator";

/**
 * Follow/unfollow endpoints carry only a :userId param.
 * The follower (the actor) always comes from the session (Section 11.5).
 */
export const followUserIdValidator = [
  param("userId")
    .isMongoId().withMessage("Invalid user id."),
];