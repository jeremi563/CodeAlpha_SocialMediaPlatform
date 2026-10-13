import { api, toast } from "/static/js/api.js";

/**
 * Wires a single global click listener (event delegation) that
 * catches clicks on any `.like-btn` in the feed.
 *
 * Event delegation means we don't have to re-wire listeners every
 * time the feed renders new posts.
 */
export function initLikes() {
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".like-btn");
    if (!btn) return;

    e.preventDefault();
    await toggleLike(btn);
  });
}

async function toggleLike(btn) {
  if (btn.disabled) return;
  const postId = btn.dataset.postId;
  const currentlyLiked = btn.classList.contains("liked");
  btn.disabled = true;

  // Optimistic UI update: flip immediately, revert on failure.
  btn.classList.toggle("liked", !currentlyLiked);
  const countEl = btn.querySelector(".like-count");
  const prev = parseInt(countEl.textContent, 10) || 0;
  countEl.textContent = currentlyLiked ? Math.max(0, prev - 1) : prev + 1;

  try {
    const method = currentlyLiked ? "delete" : "post";
    const res = method === "post"
      ? await api.post(`/api/posts/${postId}/likes`)
      : await api.delete(`/api/posts/${postId}/likes`);

    // Sync with the authoritative state from the server.
    const { likeCount, likedByMe } = res.data;
    countEl.textContent = likeCount;
    btn.classList.toggle("liked", likedByMe);
    btn.setAttribute("aria-pressed", String(likedByMe));
  } catch (err) {
    // Revert optimistic UI on failure.
    btn.classList.toggle("liked", currentlyLiked);
    countEl.textContent = prev;
    toast(err.message || "Failed to update like.", "error");
  } finally {
    btn.disabled = false;
  }
}