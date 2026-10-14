import { api, toast, timeAgo } from "/static/js/api.js";
import { setAvatar } from "/static/js/avatars.js";

const PAGE_SIZE = 20;
let activeSection = "users";
let page = 1;
let totalPages = 1;
let searchQuery = "";

await initializeAdmin();

async function initializeAdmin() {
  let user;
  try {
    const response = await api.get("/api/auth/me");
    user = response.data.user;
    if (user.role !== "admin") {
      window.location.replace("/");
      return;
    }
  } catch {
    window.location.replace("/login");
    return;
  }

  document.getElementById("my-profile-link").href = `/profile?username=${encodeURIComponent(user.username)}`;
  setSidebarAccount(user);
  document.getElementById("logout-link").addEventListener("click", async (event) => {
    event.preventDefault();
    try { await api.post("/api/auth/logout"); } finally { window.location.href = "/login"; }
  });
  document.getElementById("admin-search-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    searchQuery = document.getElementById("admin-search").value.trim();
    page = 1;
    await loadSection();
  });
  document.getElementById("admin-load-more").addEventListener("click", async () => {
    page += 1;
    await loadSection(true);
  });
  document.querySelectorAll("[data-admin-section]").forEach((button) => {
    button.addEventListener("click", async () => {
      activeSection = button.dataset.adminSection;
      page = 1;
      document.getElementById("admin-search-form").hidden = activeSection !== "users";
      document.getElementById("admin-search").value = "";
      searchQuery = "";
      document.querySelectorAll("[data-admin-section]").forEach((tab) => {
        tab.classList.toggle("active", tab === button);
        tab.setAttribute("aria-selected", String(tab === button));
      });
      await loadSection();
    });
  });

  await loadOverview();
  await loadSection();
}

async function loadOverview() {
  try {
    const response = await api.get("/api/admin/overview");
    const overview = response.data;
    for (const [key, value] of Object.entries(overview)) {
      const node = document.querySelector(`[data-stat="${key}"]`);
      if (node) node.textContent = Number(value).toLocaleString();
    }
  } catch (error) {
    toast(error.message || "Could not load the admin overview.", "error");
  }
}

async function loadSection(append = false) {
  const content = document.getElementById("admin-content");
  const status = document.getElementById("admin-list-status");
  if (!append) content.replaceChildren(makeLoading());
  status.textContent = "Loading records...";

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (activeSection === "users" && searchQuery) params.set("q", searchQuery);
  try {
    const response = await api.get(`/api/admin/${activeSection}?${params}`);
    const records = response.data[activeSection];
    totalPages = response.data.pagination.totalPages;
    if (!append) content.replaceChildren();
    if (!records.length && !append) content.append(makeEmpty());
    else for (const record of records) content.append(renderRecord(record));
    status.textContent = `${response.data.pagination.total.toLocaleString()} ${activeSection}`;
    document.getElementById("admin-load-more").hidden = page >= totalPages;
  } catch (error) {
    if (!append) content.replaceChildren(makeError(error.message));
    status.textContent = `Unable to load ${activeSection}`;
  }
}

function renderRecord(record) {
  const row = document.createElement("article");
  row.className = "admin-record";
  if (activeSection === "users") {
    const avatar = document.createElement("div");
    avatar.className = "avatar avatar-small";
    setAvatar(avatar, record.fullName, record.avatarUrl);
    const identity = document.createElement("div");
    identity.className = "admin-record-main";
    identity.append(textLine(record.fullName, "admin-record-title"), textLine(`@${record.username} · ${record.email}`, "admin-record-meta"));
    const role = textLine(record.role === "admin" ? "Administrator" : "Member", `admin-role ${record.role === "admin" ? "is-admin" : ""}`);
    const state = textLine(record.isActive ? "Active" : "Suspended", `admin-state ${record.isActive ? "is-active" : "is-suspended"}`);
    const action = document.createElement("button");
    action.type = "button";
    action.className = `btn btn-small ${record.isActive ? "btn-danger" : "btn-secondary"}`;
    action.textContent = record.isActive ? "Suspend" : "Reactivate";
    action.disabled = record.id === window.adminUserId;
    action.title = action.disabled ? "You cannot suspend your own administrator account." : "";
    action.addEventListener("click", () => setStatus(record, !record.isActive, action, state));
    row.append(avatar, identity, role, state, action);
    return row;
  }

  const body = document.createElement("div");
  body.className = "admin-record-main";
  const heading = activeSection === "posts" ? record.author : record.author;
  body.append(textLine(heading ? `${heading.fullName} · @${heading.username}` : "Deleted account", "admin-record-title"));
  const excerpt = activeSection === "comments" ? `Comment: ${record.content}` : record.content;
  body.append(textLine(excerpt, "admin-record-copy"));
  if (record.post?.id) {
    body.append(textLine(`On post: ${record.post.content}`, "admin-record-meta"));
  }
  body.append(textLine(timeAgo(record.createdAt), "admin-record-meta"));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "btn btn-small btn-danger";
  remove.textContent = `Remove ${activeSection === "posts" ? "post" : "comment"}`;
  remove.addEventListener("click", () => removeContent(record, remove));
  row.append(body, remove);
  return row;
}

async function setStatus(user, isActive, button, statusLabel) {
  const action = isActive ? "reactivate" : "suspend";
  if (!window.confirm(`Are you sure you want to ${action} @${user.username}?`)) return;
  button.disabled = true;
  try {
    await api.patch(`/api/admin/users/${user.id}/status`, { isActive });
    statusLabel.textContent = isActive ? "Active" : "Suspended";
    statusLabel.className = `admin-state ${isActive ? "is-active" : "is-suspended"}`;
    button.textContent = isActive ? "Suspend" : "Reactivate";
    button.className = `btn btn-small ${isActive ? "btn-danger" : "btn-secondary"}`;
    button.disabled = user.id === window.adminUserId;
    await loadOverview();
    toast(`Account ${isActive ? "reactivated" : "suspended"}.`, "success");
  } catch (error) {
    button.disabled = false;
    toast(error.message || `Could not ${action} this account.`, "error");
  }
}

async function removeContent(record, button) {
  const label = activeSection === "posts" ? "post and its comments, likes, and linked notifications" : "comment";
  if (!window.confirm(`Remove this ${label}? This cannot be undone.`)) return;
  button.disabled = true;
  const route = activeSection === "posts" ? `/api/admin/posts/${record.id}` : `/api/admin/comments/${record.id}`;
  try {
    await api.delete(route);
    button.closest(".admin-record")?.remove();
    await loadOverview();
    toast(`${activeSection === "posts" ? "Post" : "Comment"} removed.`, "success");
  } catch (error) {
    button.disabled = false;
    toast(error.message || "Could not remove this content.", "error");
  }
}

function setSidebarAccount(user) {
  window.adminUserId = user.id;
  const account = document.getElementById("sidebar-account");
  account.hidden = false;
  const avatar = document.createElement("div");
  avatar.className = "avatar avatar-small";
  setAvatar(avatar, user.fullName, user.avatarUrl);
  const meta = document.createElement("div");
  meta.className = "user-meta";
  const name = textLine(user.fullName, "user-name");
  const handle = textLine(`@${user.username} · Admin`, "user-handle");
  meta.append(name, handle);
  account.append(avatar, meta);
}

function textLine(text, className) {
  const node = document.createElement("span");
  node.className = className;
  node.textContent = text ?? "";
  return node;
}

function makeLoading() {
  const node = document.createElement("div");
  node.className = "loading";
  node.textContent = "Loading administration data...";
  return node;
}

function makeEmpty() {
  const node = document.createElement("div");
  node.className = "empty-state";
  node.textContent = activeSection === "users" && searchQuery ? "No accounts match that search." : `No ${activeSection} to show.`;
  return node;
}

function makeError(message) {
  const node = document.createElement("div");
  node.className = "empty-state";
  node.textContent = message || "Could not load administration data.";
  return node;
}
