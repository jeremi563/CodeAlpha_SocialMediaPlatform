import { User } from "../models/user.model.js";

async function authenticate(req, res) {
  if (!req.session || !req.session.userId) {
    res.status(401).json({ success: false, message: "Authentication required." });
    return false;
  }

  const user = await User.findById(req.session.userId).select("role isActive");
  if (!user || !user.isActive) {
    res.status(401).json({ success: false, message: "Authentication required." });
    return false;
  }

  req.userId = user._id.toString();
  req.userRole = user.role;
  return true;
}

/**
 * Requires an authenticated session.
 * Attaches the authenticated user's id to req.userId for downstream handlers.
 * Section 11.5: derive identity from session, NOT from request body.
 */
export async function requireAuth(req, res, next) {
  try {
    if (await authenticate(req, res)) next();
  } catch (error) {
    next(error);
  }
}

export async function requireAdmin(req, res, next) {
  try {
    if (!(await authenticate(req, res))) return;
    if (req.userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Administrator access required." });
    }
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Attaches req.userId if a session exists, but does not reject anonymous users.
 * Used for endpoints that behave differently when logged in (e.g., feed with
 * "did I like this post?" flags) but still work for anonymous users.
 */
export function optionalAuth(req, res, next) {
  if (req.session && req.session.userId) {
    req.userId = req.session.userId;
  }
  next();
}