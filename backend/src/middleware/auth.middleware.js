/**
 * Requires an authenticated session.
 * Attaches the authenticated user's id to req.userId for downstream handlers.
 * Section 11.5: derive identity from session, NOT from request body.
 */
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }
  req.userId = req.session.userId;
  next();
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