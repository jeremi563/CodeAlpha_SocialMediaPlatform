import { Router } from "express";
import * as postController from "../controllers/post.controller.js";
import * as commentController from "../controllers/comment.controller.js";
import * as likeController from "../controllers/like.controller.js";
import {
  createPostValidator,
  updatePostValidator,
  postIdParamValidator,
} from "../validators/post.validator.js";
import {
  createCommentValidator,
} from "../validators/comment.validator.js";
import { likePostIdValidator } from "../validators/like.validator.js";
import { paginationValidator } from "../validators/user.validator.js";
import { requireAuth, optionalAuth } from "../middleware/auth.middleware.js";

const router = Router();

// ---- Posts ----

router.get("/", optionalAuth, paginationValidator, postController.getFeed);
router.post("/", requireAuth, createPostValidator, postController.createPost);
router.get("/:postId", optionalAuth, postIdParamValidator, postController.getPost);
router.patch(
  "/:postId",
  requireAuth,
  postIdParamValidator,
  updatePostValidator,
  postController.updatePost
);
router.delete(
  "/:postId",
  requireAuth,
  postIdParamValidator,
  postController.deletePost
);

// ---- Comments on a post ----

router.post(
  "/:postId/comments",
  requireAuth,
  postIdParamValidator,       // reuse — same param name and format
  createCommentValidator,
  commentController.createComment
);

router.get(
  "/:postId/comments",
  optionalAuth,
  postIdParamValidator,
  paginationValidator,
  commentController.getPostComments
);

// ---- Likes on a post ----

router.post(
  "/:postId/likes",
  requireAuth,
  likePostIdValidator,
  likeController.likePost
);

router.delete(
  "/:postId/likes",
  requireAuth,
  likePostIdValidator,
  likeController.unlikePost
);

export default router;