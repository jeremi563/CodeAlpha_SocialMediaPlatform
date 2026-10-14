import { validationResult } from "express-validator";
import { PAGINATION } from "../config/constants.js";
import * as notificationService from "../services/notification.service.js";

function sendValidationErrors(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed.",
    errors: errors.array().map((error) => ({ field: error.path, message: error.msg })),
  });
}

export async function listNotifications(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);

    const page = req.query.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = req.query.limit ?? 20;
    const result = await notificationService.getNotifications(req.userId, { page, limit });

    return res.status(200).json({
      success: true,
      data: {
        notifications: result.notifications,
        unreadCount: result.unreadCount,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit) || 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);

    const updated = await notificationService.markNotificationRead(req.params.notificationId, req.userId);
    if (!updated) {
      return res.status(404).json({ success: false, message: "Notification not found." });
    }
    return res.status(200).json({ success: true, message: "Notification marked as read." });
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsRead(req, res, next) {
  try {
    const updatedCount = await notificationService.markAllNotificationsRead(req.userId);
    return res.status(200).json({
      success: true,
      message: "Notifications marked as read.",
      data: { updatedCount },
    });
  } catch (error) {
    next(error);
  }
}
