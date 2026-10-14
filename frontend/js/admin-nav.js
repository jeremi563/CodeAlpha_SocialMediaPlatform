import { api } from "/static/js/api.js";

async function addAdminNavigation() {
  try {
    const response = await api.get("/api/auth/me");
    if (response.data.user.role !== "admin") return;

    const nav = document.querySelector(".sidebar-left nav");
    if (!nav || nav.querySelector('[data-admin-nav="true"]')) return;
    const link = document.createElement("a");
    link.href = "/admin";
    link.dataset.adminNav = "true";
    link.innerHTML = '<svg class="icon"><use href="/static/assets/icons.svg#i-shield"></use></svg><span>Admin</span>';
    if (window.location.pathname === "/admin") link.classList.add("active");
    const divider = nav.querySelector(".nav-divider");
    nav.insertBefore(link, divider || nav.lastElementChild);
    nav.classList.add("has-admin-link");
  } catch {
    // The page's own auth flow handles signed-out users.
  }
}

addAdminNavigation();
