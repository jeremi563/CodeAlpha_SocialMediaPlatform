import { api, escapeHtml, toast } from "/static/js/api.js";
import { openFormDialog } from "/static/js/dialog.js";
import { initPostActions, renderPost, setPostCurrentUser } from "/static/js/feed.js";

let currentUser = null;

export async function initProfile() {
  // Read username from query string: /profile?username=alicew
  const params = new URLSearchParams(window.location.search);
  const username = params.get("username");

  if (!username) {
    window.location.href = "/";
    return;
  }

  try {
    const me = await api.get("/api/auth/me");
    currentUser = me.data.user;
  } catch {
    currentUser = null;
  }

  setPostCurrentUser(currentUser);
  initPostActions();

  await loadProfile(username);
}

async function loadProfile(username) {
  const root = document.getElementById("profile-root");

  try {
    const res = await api.get(`/api/users/${encodeURIComponent(username)}`);
    const { user, stats } = res.data;
    renderProfile(root, user, stats);
    await loadUserPosts(username);
  } catch (err) {
    if (err.status === 404) {
      root.innerHTML = `<div class="empty-state">User not found.</div>`;
    } else {
      root.innerHTML = `<div class="empty-state">Failed to load profile.</div>`;
    }
  }
}

function renderProfile(root, user, stats) {
  const isMe = currentUser && currentUser.id === user.id;
  const initials = (user.fullName || user.username || "?")
    .split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  let actionHtml = "";
  if (isMe) {
    actionHtml = `<button class="btn btn-secondary" id="edit-profile-btn"><svg class="icon icon-sm"><use href="/static/assets/icons.svg#i-edit"></use></svg><span>Edit profile</span></button>`;
  } else if (currentUser) {
    actionHtml = `
      <button type="button" class="btn ${stats.isFollowing ? "btn-secondary following" : "btn-primary"} follow-btn"
              data-user-id="${user.id}" aria-pressed="${stats.isFollowing}">
        ${stats.isFollowing ? "Following" : "Follow"}
      </button>
    `;
  }

  root.innerHTML = `
    <div class="profile-header">
      <div class="profile-cover"></div>
      <div class="profile-info">
        <div class="profile-mainline">
          <div><div class="avatar avatar-large profile-avatar">${escapeHtml(initials)}</div><h2 class="profile-name">${escapeHtml(user.fullName)}</h2><div class="profile-username">@${escapeHtml(user.username)}</div></div>
          <div class="profile-actions">${actionHtml}</div>
        </div>
        <div class="profile-bio">${user.bio ? escapeHtml(user.bio) : '<span style="color:var(--muted)">No bio yet.</span>'}</div>
        <div class="profile-stats">
          <span class="profile-stat"><strong>${stats.postCount}</strong> Posts</span>
          <span class="profile-stat"><strong class="follower-count">${stats.followerCount}</strong> Followers</span>
          <span class="profile-stat"><strong>${stats.followingCount}</strong> Following</span>
        </div>
      </div>
    </div>
  `;

  if (isMe) {
    const editBtn = document.getElementById("edit-profile-btn");
    editBtn.addEventListener("click", () => openEditForm(user));
  }
}

async function loadUserPosts(username) {
  const container = document.getElementById("user-posts");
  container.innerHTML = `<div class="loading">Loading posts...</div>`;

  try {
    const res = await api.get(`/api/users/${encodeURIComponent(username)}/posts?limit=20`);
    const posts = res.data.posts;

    if (posts.length === 0) {
      container.innerHTML = `<div class="empty-state">No posts yet.</div>`;
      return;
    }

    container.innerHTML = "";
    for (const p of posts) {
      container.appendChild(renderPost(p));
    }
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Failed to load posts.</div>`;
  }
}

async function openEditForm(user) {
  const values = await openFormDialog({
    title: "Edit your profile",
    submitLabel: "Save profile",
    fields: [
      { name: "fullName", label: "Full name", value: user.fullName, maxLength: 80 },
      { name: "username", label: "Username", value: user.username, maxLength: 20, pattern: "[a-z0-9_]{3,20}" },
      { name: "bio", label: "Bio", value: user.bio || "", maxLength: 280, multiline: true, required: false, rows: 3 },
    ],
  });
  if (!values) return;

  try {
    await api.patch("/api/users/me", values);
    toast("Profile updated.", "success");
    if (values.username !== user.username) {
      window.location.assign(`/profile?username=${encodeURIComponent(values.username)}`);
    } else {
      window.location.reload();
    }
  } catch (error) {
    toast(error.message || "Could not update your profile.", "error");
  }
}