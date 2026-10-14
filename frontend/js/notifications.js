import { api, timeAgo, toast } from "/static/js/api.js";
import { setAvatar } from "/static/js/avatars.js";

const PAGE_SIZE = 20;
const NOTIFICATION_REFRESH_INTERVAL_MS = 20000;
let page = 1;
let totalPages = 1;
let notificationRefreshInFlight = false;

export async function initNotifications(user) {
  document.getElementById("my-profile-link").href = `/profile?username=${encodeURIComponent(user.username)}`;
  setSidebarAccount(user);
  document.getElementById("logout-link").addEventListener("click", async (event) => {
    event.preventDefault();
    try { await api.post("/api/auth/logout"); } finally { window.location.href = "/login"; }
  });

  document.getElementById("mark-all-read").addEventListener("click", markAllRead);
  document.getElementById("load-more-notifications").addEventListener("click", async () => {
    page += 1;
    await loadNotifications(true);
  });
  await loadNotifications();
  window.setInterval(() => {
    if (document.visibilityState === "visible") refreshNotifications();
  }, NOTIFICATION_REFRESH_INTERVAL_MS);
}

async function refreshNotifications() {
  if (notificationRefreshInFlight) return;
  notificationRefreshInFlight = true;
  try {
    const response = await api.get(`/api/notifications?page=1&limit=${PAGE_SIZE}`);
    const { notifications, unreadCount } = response.data;
    const list = document.getElementById("notification-list");
    const existing = new Map(
      [...list.querySelectorAll(".notification-item")].map((item) => [item.dataset.notificationId, item])
    );
    const newItems = [];

    for (const notification of notifications) {
      const item = existing.get(notification.id);
      if (!item) {
        newItems.push(notification);
      } else if (notification.readAt) {
        markItemRead(item);
      }
    }

    list.querySelector(".notification-empty")?.remove();
    for (const notification of newItems.reverse()) list.prepend(renderNotification(notification));
    document.getElementById("unread-count").textContent = unreadCount;
    document.getElementById("mark-all-read").disabled = unreadCount === 0;
    document.getElementById("notification-status").textContent = unreadCount ? `${unreadCount} unread` : "You're all caught up";
    updateBadge(unreadCount);
  } catch {
    // Keep the current inbox visible if a background refresh fails.
  } finally {
    notificationRefreshInFlight = false;
  }
}

async function loadNotifications(append = false) {
  const list = document.getElementById("notification-list");
  const status = document.getElementById("notification-status");
  if (!append) {
    page = 1;
    list.replaceChildren(makeLoading());
  }

  try {
    const response = await api.get(`/api/notifications?page=${page}&limit=${PAGE_SIZE}`);
    const { notifications, unreadCount, pagination } = response.data;
    totalPages = pagination.totalPages;
    document.getElementById("unread-count").textContent = unreadCount;
    document.getElementById("mark-all-read").disabled = unreadCount === 0;
    status.textContent = unreadCount ? `${unreadCount} unread` : "You're all caught up";
    if (!append) list.replaceChildren();

    if (!notifications.length && !append) {
      list.append(makeEmpty());
    } else {
      for (const notification of notifications) list.append(renderNotification(notification));
    }
    document.getElementById("load-more-notifications").hidden = page >= totalPages;
    updateBadge(unreadCount);
  } catch (error) {
    if (!append) list.replaceChildren(makeError(error.message));
    status.textContent = "Unable to load notifications";
  }
}

function renderNotification(notification) {
  const item = document.createElement("article");
  item.className = `notification-item${notification.readAt ? "" : " is-unread"}`;
  item.dataset.notificationId = notification.id;

  const link = document.createElement("a");
  link.className = "notification-link";
  link.href = notification.href;
  link.addEventListener("click", async (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    await markOneRead(notification.id, item);
    window.location.assign(notification.href);
  });

  const avatar = document.createElement("div");
  avatar.className = "avatar avatar-small notification-avatar";
  setAvatar(avatar, notification.actor?.fullName, notification.actor?.avatarUrl);

  const content = document.createElement("div");
  content.className = "notification-content";
  const text = document.createElement("p");
  const actorName = document.createElement("strong");
  actorName.textContent = notification.actor?.fullName || "A user";
  text.append(actorName, document.createTextNode(` ${notification.message}.`));
  const time = document.createElement("time");
  time.className = "notification-time";
  time.dateTime = notification.createdAt;
  time.textContent = timeAgo(notification.createdAt);
  content.append(text, time);

  const unreadDot = document.createElement("span");
  unreadDot.className = "notification-unread-dot";
  unreadDot.setAttribute("aria-label", notification.readAt ? "Read" : "Unread");
  link.append(avatar, content, unreadDot);

  if (!notification.readAt) {
    const markRead = document.createElement("button");
    markRead.type = "button";
    markRead.className = "notification-mark-read icon-btn";
    markRead.setAttribute("aria-label", "Mark notification as read");
    markRead.title = "Mark as read";
    markRead.innerHTML = '<svg class="icon icon-sm"><use href="/static/assets/icons.svg#i-check"></use></svg>';
    markRead.addEventListener("click", async () => markOneRead(notification.id, item));
    item.append(link, markRead);
  } else {
    item.append(link);
  }
  return item;
}

async function markOneRead(id, item) {
  if (!item.classList.contains("is-unread")) return;
  try {
    await api.patch(`/api/notifications/${id}/read`);
    markItemRead(item);
    const unread = document.getElementById("unread-count");
    const next = Math.max(0, Number(unread.textContent) - 1);
    unread.textContent = next;
    document.getElementById("mark-all-read").disabled = next === 0;
    document.getElementById("notification-status").textContent = next ? `${next} unread` : "You're all caught up";
    updateBadge(next);
  } catch (error) {
    toast(error.message || "Could not mark notification as read.", "error");
  }
}

async function markAllRead() {
  const button = document.getElementById("mark-all-read");
  button.disabled = true;
  try {
    await api.patch("/api/notifications/read-all");
    document.querySelectorAll(".notification-item.is-unread").forEach((item) => {
      markItemRead(item);
    });
    document.getElementById("unread-count").textContent = "0";
    document.getElementById("notification-status").textContent = "You're all caught up";
    updateBadge(0);
    toast("All notifications marked as read.", "success");
  } catch (error) {
    button.disabled = false;
    toast(error.message || "Could not update notifications.", "error");
  }
}

function markItemRead(item) {
  item.classList.remove("is-unread");
  item.querySelector(".notification-mark-read")?.remove();
  item.querySelector(".notification-unread-dot")?.setAttribute("aria-label", "Read");
}

function setSidebarAccount(user) {
  const account = document.getElementById("sidebar-account");
  account.hidden = false;
  const avatar = document.createElement("div");
  avatar.className = "avatar avatar-small";
  setAvatar(avatar, user.fullName, user.avatarUrl);
  const meta = document.createElement("div");
  meta.className = "user-meta";
  const name = document.createElement("span");
  name.className = "user-name";
  name.textContent = user.fullName;
  const handle = document.createElement("span");
  handle.className = "user-handle";
  handle.textContent = `@${user.username}`;
  meta.append(name, handle);
  account.append(avatar, meta);
}

function updateBadge(count) {
  const badge = document.querySelector(".notification-badge");
  if (!badge) return;
  badge.textContent = count > 99 ? "99+" : String(count);
  badge.hidden = count === 0;
}

function makeLoading() {
  const loading = document.createElement("div");
  loading.className = "loading";
  loading.textContent = "Loading notifications...";
  return loading;
}

function makeEmpty() {
  const empty = document.createElement("div");
  empty.className = "empty-state notification-empty";
  const icon = document.createElement("span");
  icon.className = "state-icon";
  icon.innerHTML = '<svg class="icon"><use href="/static/assets/icons.svg#i-bell"></use></svg>';
  const title = document.createElement("strong");
  title.textContent = "No notifications yet";
  const copy = document.createElement("span");
  copy.textContent = "Likes, comments, and new followers will show up here.";
  empty.append(icon, title, copy);
  return empty;
}

function makeError(message) {
  const error = document.createElement("div");
  error.className = "empty-state";
  error.textContent = message || "Could not load notifications.";
  return error;
}
