/**
 * theme.js — Dark / Light theme manager
 *
 * • Reads user preference from localStorage ("social-theme": "dark" | "light")
 * • Falls back to the OS prefers-color-scheme media query
 * • Applies `data-theme="dark"` on <html> for dark mode; removes it for light
 * • Injects a toggle button into the sidebar nav (app pages) or a floating
 *   button (auth pages) — works on every page without touching HTML files
 * • Persists the choice in localStorage across sessions
 */

const STORAGE_KEY = "social-theme";

function getPreference() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const html = document.documentElement;
  if (theme === "dark") {
    html.setAttribute("data-theme", "dark");
  } else {
    html.removeAttribute("data-theme");
  }
  // Update meta theme-color for mobile browser chrome
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.content = theme === "dark" ? "#0f1f18" : "#edf3ef";
  }
}

function savePreference(theme) {
  localStorage.setItem(STORAGE_KEY, theme);
}

function buildBtnHTML(theme) {
  const sunIcon = `<svg class="icon theme-icon theme-icon-sun" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  const moonIcon = `<svg class="icon theme-icon theme-icon-moon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  const label = `<span class="theme-toggle-label">${theme === "dark" ? "Light mode" : "Dark mode"}</span>`;
  return (theme === "dark" ? sunIcon : moonIcon) + label;
}

function createToggleButton(currentTheme) {
  const btn = document.createElement("button");
  btn.id = "theme-toggle-btn";
  btn.type = "button";
  btn.className = "theme-toggle-btn";
  btn.setAttribute("aria-label", currentTheme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  btn.setAttribute("title", currentTheme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  btn.setAttribute("aria-pressed", currentTheme === "dark" ? "true" : "false");
  btn.innerHTML = buildBtnHTML(currentTheme);
  return btn;
}

function updateButton(btn, theme) {
  btn.innerHTML = buildBtnHTML(theme);
  btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  btn.setAttribute("title", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
}

function injectButton(currentTheme) {
  // App pages: inject into sidebar nav before the divider
  const nav = document.querySelector(".sidebar-left nav");
  if (nav) {
    const btn = createToggleButton(currentTheme);
    const divider = nav.querySelector(".nav-divider");
    if (divider) {
      nav.insertBefore(btn, divider);
    } else {
      nav.appendChild(btn);
    }
    return btn;
  }

  // Auth pages: floating button in bottom-right of auth-panel
  const authPanel = document.querySelector(".auth-panel");
  if (authPanel) {
    const btn = createToggleButton(currentTheme);
    btn.classList.add("theme-toggle-btn--auth");
    authPanel.appendChild(btn);
    return btn;
  }

  // Fallback: floating button appended to body
  const btn = createToggleButton(currentTheme);
  btn.classList.add("theme-toggle-btn--floating");
  document.body.appendChild(btn);
  return btn;
}

// Apply theme immediately before first paint to prevent FOUC
const initialTheme = getPreference();
applyTheme(initialTheme);

function boot() {
  let currentTheme = getPreference();
  const btn = injectButton(currentTheme);

  btn.addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(currentTheme);
    savePreference(currentTheme);
    updateButton(btn, currentTheme);
  });

  // React to OS preference changes when user has not manually set a preference
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      currentTheme = e.matches ? "dark" : "light";
      applyTheme(currentTheme);
      updateButton(btn, currentTheme);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
