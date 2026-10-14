import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import {
  updateProfileValidator,
  searchUsersValidator,
  usernameParamValidator,
  paginationValidator,
  deleteAccountValidator,
} from "../validators/user.validator.js";
import { requireAuth, optionalAuth } from "../middleware/auth.middleware.js";
import multer from "multer";

const router = Router();
const profilePictureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

function parseProfilePicture(req, res, next) {
  profilePictureUpload.single("profilePicture")(req, res, (err) => {
    if (!err) return next();
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(status).json({
      success: false,
      message: status === 413 ? "Profile pictures must be 5 MB or smaller." : "Invalid image upload.",
    });
  });
}

router.post(
  "/me/profile-picture",
  requireAuth,
  parseProfilePicture,
  userController.uploadProfilePicture
);
router.delete("/me/profile-picture", requireAuth, userController.deleteProfilePicture);

// Account deletion — permanently removes the authenticated user and all
// associated data (posts, comments, likes, follows, notifications, avatar).
// Requires password confirmation. Section 5.10.
router.delete("/me", requireAuth, deleteAccountValidator, userController.deleteAccount);

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

router.get(
  "/:username/avatar/:pictureId",
  usernameParamValidator,
  userController.getProfilePicture
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