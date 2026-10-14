import { validationResult } from "express-validator";
import { PAGINATION } from "../config/constants.js";
import * as adminService from "../services/admin.service.js";

function sendValidationErrors(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed.",
    errors: errors.array().map((error) => ({ field: error.path, message: error.msg })),
  });
}

function pagination(req) {
  return {
    page: req.query.page ?? PAGINATION.DEFAULT_PAGE,
    limit: req.query.limit ?? 20,
  };
}

function sendList(res, key, result, page, limit) {
  return res.status(200).json({
    success: true,
    data: {
      [key]: result[key],
      pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) || 1 },
    },
  });
}

export async function overview(req, res, next) {
  try {
    return res.status(200).json({ success: true, data: await adminService.getOverview() });
  } catch (error) {
    next(error);
  }
}

export async function users(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);
    const { page, limit } = pagination(req);
    const result = await adminService.listUsers({ page, limit, query: req.query.q || "" });
    return sendList(res, "users", result, page, limit);
  } catch (error) {
    next(error);
  }
}

export async function setUserStatus(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);
    const user = await adminService.setUserActiveStatus(req.params.userId, req.userId, req.body.isActive);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    return res.status(200).json({ success: true, message: user.isActive ? "Account reactivated." : "Account suspended.", data: { user } });
  } catch (error) {
    next(error);
  }
}

export async function posts(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);
    const { page, limit } = pagination(req);
    return sendList(res, "posts", await adminService.listPosts({ page, limit }), page, limit);
  } catch (error) {
    next(error);
  }
}

export async function removePost(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);
    if (!(await adminService.deletePost(req.params.postId))) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }
    return res.status(200).json({ success: true, message: "Post removed by an administrator." });
  } catch (error) {
    next(error);
  }
}

export async function comments(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);
    const { page, limit } = pagination(req);
    return sendList(res, "comments", await adminService.listComments({ page, limit }), page, limit);
  } catch (error) {
    next(error);
  }
}

export async function removeComment(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);
    if (!(await adminService.deleteComment(req.params.commentId))) {
      return res.status(404).json({ success: false, message: "Comment not found." });
    }
    return res.status(200).json({ success: true, message: "Comment removed by an administrator." });
  } catch (error) {
    next(error);
  }
}
