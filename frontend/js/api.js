/**
 * Reusable HTTP utilities for talking to the backend.
 * Section 7.1: standardize requests, JSON, errors, credentials.
 */

/**
 * Custom error thrown when the API returns a non-2xx status.
 * Carries the status code and the parsed error body so callers
 * can react precisely (e.g., redirect on 401).
 */
export class ApiError extends Error {
  constructor(message, status, errors = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

/**
 * Core request function. All other helpers funnel through here.
 */
async function request(method, url, body = null) {
  const options = {
    method,
    headers: {
      Accept: "application/json",
    },
    credentials: "same-origin", // send session cookie
  };

  if (body !== null) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch (networkError) {
    throw new ApiError("Network error. Check your connection.", 0);
  }

  // 204 No Content has no body
  if (response.status === 204) {
    return { success: true };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError("Invalid response from server.", response.status);
  }

  if (!response.ok) {
    throw new ApiError(
      data.message || "Request failed.",
      response.status,
      data.errors || []
    );
  }

  return data;
}

export const api = {
  get: (url) => request("GET", url),
  post: (url, body) => request("POST", url, body),
  patch: (url, body) => request("PATCH", url, body),
  delete: (url) => request("DELETE", url),
};

/**
 * Escapes text before inserting into the DOM.
 * Section 12.4: user-generated content must not be treated as HTML.
 */
export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Formats an ISO date string as a relative "time ago" string.
 */
export function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Simple toast for success/error feedback.
 */
export function toast(message, type = "info") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
  el.textContent = message;
  el.className = `toast toast-${type} toast-visible`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.classList.remove("toast-visible");
  }, 3000);
}