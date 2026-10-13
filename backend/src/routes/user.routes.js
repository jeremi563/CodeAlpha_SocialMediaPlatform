import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import {
  updateProfileValidator,
  searchUsersValidator,
  usernameParamValidator,
  paginationValidator,
} from "../validators/user.validator.js";
import { requireAuth, optionalAuth } from "../middleware/auth.middleware.js";

const router = Router();

// Search (Section 9.2: auth required)
router.get(
  "/search",
  requireAuth,
  searchUsersValidator,
  userController.searchUsers
);

// Current-user profile update
router.patch(
  "/me",
  requireAuth,
  updateProfileValidator,
  userController.updateMe
);

// Public profile lookup
router.get(
  "/:username",
  optionalAuth,
  usernameParamValidator,
  userController.getProfile
);

// Posts by user
router.get(
  "/:username/posts",
  optionalAuth,
  usernameParamValidator,
  paginationValidator,
  userController.getUserPosts
);

// Followers / following lists
router.get(
  "/:username/followers",
  optionalAuth,
  usernameParamValidator,
  paginationValidator,
  userController.getFollowers
);

router.get(
  "/:username/following",
  optionalAuth,
  usernameParamValidator,
  paginationValidator,
  userController.getFollowing
);

export default router;