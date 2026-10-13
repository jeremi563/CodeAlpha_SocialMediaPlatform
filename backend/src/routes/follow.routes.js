import { Router } from "express";
import * as followController from "../controllers/follow.controller.js";
import { followUserIdValidator } from "../validators/follow.validator.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

// POST /api/users/:userId/follow
router.post(
  "/:userId/follow",
  requireAuth,
  followUserIdValidator,
  followController.followUser
);

// DELETE /api/users/:userId/follow
router.delete(
  "/:userId/follow",
  requireAuth,
  followUserIdValidator,
  followController.unfollowUser
);

export default router;