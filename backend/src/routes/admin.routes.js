import { Router } from "express";
import { body, param, query } from "express-validator";
import * as adminController from "../controllers/admin.controller.js";
import { requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();
const idParam = (name) => param(name).isMongoId().withMessage(`Invalid ${name}.`);
const paginationRules = [
  query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer.").toInt(),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("limit must be between 1 and 50.").toInt(),
];

router.use(requireAdmin);
router.get("/overview", adminController.overview);
router.get("/users", ...paginationRules, query("q").optional().trim().isLength({ max: 80 }).withMessage("Search query is too long."), adminController.users);
router.patch("/users/:userId/status", idParam("userId"), body("isActive").isBoolean().withMessage("isActive must be a boolean.").toBoolean(), adminController.setUserStatus);
router.get("/posts", ...paginationRules, adminController.posts);
router.delete("/posts/:postId", idParam("postId"), adminController.removePost);
router.get("/comments", ...paginationRules, adminController.comments);
router.delete("/comments/:commentId", idParam("commentId"), adminController.removeComment);

export default router;
