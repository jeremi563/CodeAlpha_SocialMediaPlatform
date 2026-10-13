import { api, ApiError } from "/static/js/api.js";

/**
 * Returns the current authenticated user, or null.
 * Safe to call from any page.
 */
export async function fetchCurrentUser() {
  try {
    const res = await api.get("/api/auth/me");
    return res.data.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

/**
 * Called on the home feed on page load:
 *   - Redirects to /login if not authenticated.
 *   - Wires the logout button.
 * Returns { user } when authenticated, or null (after redirect).
 */
export async function initAuth() {
  const user = await fetchCurrentUser();

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  // Wire the logout link
  const logoutLink = document.getElementById("logout-link");
  if (logoutLink) {
    logoutLink.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await api.post("/api/auth/logout");
      } finally {
        window.location.href = "/login";
      }
    });
  }

  return { user };
}