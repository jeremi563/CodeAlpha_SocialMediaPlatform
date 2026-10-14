import { api, toast } from "/static/js/api.js";
import { setAvatar } from "/static/js/avatars.js";

let currentUser = null;

export function initFollows() {
  // Global click delegation for any `.follow-btn`
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".follow-btn");
    if (!btn) return;
    e.preventDefault();
    await toggleFollow(btn);
  });

  // Cache current user
  api.get("/api/auth/me").then((res) => {
    currentUser = res.data.user;
    loadDiscover();
  }).catch(() => {
    currentUser = null;
    const container = document.getElementById("discover");
    if (container) {
      container.textContent = "Sign in to discover people.";
      container.className = "side-note";
    }
  });
}

async function toggleFollow(btn) {
  const userId = btn.dataset.userId;
  if (!userId || btn.disabled) return;

  const isFollowing = btn.classList.contains("following");
  btn.disabled = true;
  btn.setAttribute("aria-busy", "true");

  try {
    const res = isFollowing
      ? await api.delete(`/api/users/${userId}/follow`)
      : await api.post(`/api/users/${userId}/follow`);

    // Sync with server truth
    const { isFollowing: nowFollowing } = res.data;
    btn.classList.toggle("following", nowFollowing);
    btn.classList.toggle("btn-primary", !nowFollowing);
    btn.classList.toggle("btn-secondary", nowFollowing);
    btn.textContent = nowFollowing ? "Following" : "Follow";
    btn.setAttribute("aria-pressed", String(nowFollowing));

    if (Number.isFinite(res.data.followerCount)) updateFollowerCount(res.data.followerCount);
  } catch (err) {
    toast(err.message || "Failed to update follow.", "error");
  } finally {
    btn.disabled = false;
    btn.removeAttribute("aria-busy");
  }
}

function updateFollowerCount(value) {
  const el = document.querySelector(".follower-count");
  if (!el) return;
  el.textContent = value;
}

/**
 * Right-sidebar "suggested users" (Section 6.2).
 * Simple approach: fetch a few users from search and filter out self.
 */
async function loadDiscover() {
  const container = document.getElementById("discover");
  if (!container || !currentUser) return;

  container.textContent = "";
  const loading = document.createElement("div");
  loading.className = "loading";
  loading.textContent = "Finding people...";
  container.append(loading);

  try {
    // Search with a broad query to get a list of users.
    // Real recommendation would use the following graph; for MVP this is fine.
    const res = await api.get("/api/users/search?q=a");
    const users = (res.data.users || []).filter((u) => u.id !== currentUser.id).slice(0, 4);

    if (users.length === 0) {
      container.textContent = "No suggestions yet.";
      container.className = "side-note";
      return;
    }

    container.replaceChildren();
    for (const person of users) {
      const row = document.createElement("div");
      row.className = "suggestion";
      const avatar = document.createElement("div");
      avatar.className = "avatar avatar-small";
      setAvatar(avatar, person.fullName, person.avatarUrl);
      const info = document.createElement("div");
      info.className = "suggestion-info";
      const link = document.createElement("a");
      link.href = `/profile?username=${encodeURIComponent(person.username)}`;
      link.textContent = person.fullName;
      const handle = document.createElement("span");
      handle.textContent = `@${person.username}`;
      info.append(link, handle);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-secondary btn-small follow-btn";
      button.dataset.userId = person.id;
      button.textContent = "Follow";
      row.append(avatar, info, button);
      container.append(row);
    }
  } catch {
    container.textContent = "Suggestions are unavailable right now.";
    container.className = "side-note";
  }
}