export function initials(name) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function setAvatar(element, name, avatarUrl) {
  if (!element) return;
  element.querySelector(".avatar-image")?.remove();
  element.textContent = initials(name);
  element.setAttribute("aria-hidden", "true");

  if (!avatarUrl) return;
  const image = document.createElement("img");
  image.className = "avatar-image";
  image.src = avatarUrl;
  image.alt = "";
  image.decoding = "async";
  image.addEventListener("error", () => image.remove(), { once: true });
  element.append(image);
}