import { validationResult } from "express-validator";
import * as authService from "../services/auth.service.js";
import { User } from "../models/user.model.js";

/**
 * POST /api/auth/register
 */
export async function register(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }

    const { fullName, username, email, password } = req.body;
    const user = await authService.registerUser({
      fullName,
      username,
      email,
      password,
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      data: { user: user.toJSON() },
    });
  } catch (err) {
    next(err); // hand off to centralized error middleware
  }
}

/**
 * POST /api/auth/login
 */
export async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }

    const { identifier, password } = req.body;

    const user = await authService.findUserByIdentifier(identifier);
    if (!user || !user.isActive) {
      // Section 11.3: generic error, do not reveal whether the account exists
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    const ok = await authService.verifyPassword(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    // Regenerate the session id to prevent session fixation (Section 12.5)
    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.userId = user._id.toString();
      req.session.save((err2) => {
        if (err2) return next(err2);

        return res.status(200).json({
          success: true,
          message: "Logged in successfully.",
          data: { user: user.toJSON() },
        });
      });
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 */
export async function logout(req, res, next) {
  if (!req.session) {
    return res.status(200).json({ success: true, message: "Logged out." });
  }

  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("smp.sid"); // matches the name set in session.js
    return res.status(200).json({ success: true, message: "Logged out." });
  });
}

/**
 * GET /api/auth/me
 */
export async function me(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      // Session referenced a user that no longer exists
      return req.session.destroy(() => {
        res.clearCookie("smp.sid");
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
      });
    }

    return res.status(200).json({
      success: true,
      data: { user: user.toJSON() },
    });
  } catch (err) {
    next(err);
  }
}