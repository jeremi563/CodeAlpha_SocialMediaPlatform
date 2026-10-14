import { api } from "/static/js/api.js";

export async function refreshNotificationBadge() {
  const badge = document.querySelector(".notification-badge");
  if (!badge) return;
  try {
    const response = await api.get("/api/notifications?page=1&limit=1");
    const count = response.data.unreadCount || 0;
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.hidden = count === 0;
    badge.closest("a")?.setAttribute("aria-label", count ? `Notifications, ${count} unread` : "Notifications");
  } catch {
    badge.hidden = true;
  }
}

refreshNotificationBadge();
