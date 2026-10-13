import session from "express-session";
import MongoStore from "connect-mongo";

/**
 * Builds and returns the express-session middleware configured
 * with a MongoDB-backed store (Section 11.1).
 */
export function createSessionMiddleware() {
  const isProduction = process.env.NODE_ENV === "production";
  const store = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: "sessions", // Section 5.7
    ttl: 60 * 60 * 24 * 7,      // 7 days, matches cookie maxAge
    autoRemove: "native",       // MongoDB TTL index handles cleanup
  });

  const middleware = session({
    name: "smp.sid", // custom cookie name; don't advertise "connect.sid"
    secret: process.env.SESSION_SECRET,
    resave: false,             // don't save if unchanged
    saveUninitialized: false,  // don't create sessions for anonymous visitors
    rolling: true,             // refresh expiry on each request
    store,
    cookie: {
      httpOnly: true,                  // Section 12.5 - not accessible to JS
      secure: isProduction,            // Section 12.5 - HTTPS only in prod
      sameSite: "lax",                 // Section 12.5 - CSRF mitigation
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days in ms
    },
  });

  middleware.store = store;
  return middleware;
}