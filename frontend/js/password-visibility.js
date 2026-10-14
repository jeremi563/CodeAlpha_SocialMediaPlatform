export function initPasswordToggles(root = document) {
  root.querySelectorAll("[data-password-toggle]").forEach((button) => {
    const input = document.getElementById(button.getAttribute("aria-controls"));
    if (!input || button.dataset.initialized === "true") return;
    button.dataset.initialized = "true";

    button.addEventListener("click", () => {
      const reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      button.setAttribute("aria-pressed", String(reveal));
      button.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
      button.title = reveal ? "Hide password" : "Show password";
      button.querySelector("use")?.setAttribute(
        "href",
        `/static/assets/icons.svg#${reveal ? "i-eye-off" : "i-eye"}`
      );
    });
  });
}

initPasswordToggles();
