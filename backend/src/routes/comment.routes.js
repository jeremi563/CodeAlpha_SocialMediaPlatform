import { Router } from "express";
import * as commentController from "../controllers/comment.controller.js";
import {
  updateCommentValidator,
  commentIdParamValidator,
} from "../validators/comment.validator.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

// PATCH /api/comments/:commentId
router.patch(
  "/:commentId",
  requireAuth,
  commentIdParamValidator,
  updateCommentValidator,
  commentController.updateComment
);

// DELETE /api/comments/:commentId
router.delete(
  "/:commentId",
  requireAuth,
  commentIdParamValidator,
  commentController.deleteComment
);

export default router;