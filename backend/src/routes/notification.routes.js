import { Router } from "express";
import { param } from "express-validator";
import * as notificationController from "../controllers/notification.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { paginationValidator } from "../validators/user.validator.js";

const router = Router();

router.get("/", requireAuth, paginationValidator, notificationController.listNotifications);
router.patch("/read-all", requireAuth, notificationController.markAllNotificationsRead);
router.patch(
  "/:notificationId/read",
  requireAuth,
  param("notificationId").isMongoId().withMessage("Invalid notification id."),
  notificationController.markNotificationRead
);

export default router;
