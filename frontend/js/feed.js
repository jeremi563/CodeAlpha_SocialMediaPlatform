import { api, escapeHtml, timeAgo, toast } from "/static/js/api.js";
import { openFormDialog } from "/static/js/dialog.js";
import { setAvatar } from "/static/js/avatars.js";

let currentUser = null;
let currentPage = 1;
let totalPages = 1;
let postActionsAttached = false;
const LIMIT = 10;
const FEED_REFRESH_INTERVAL_MS = 15000;
let feedRefreshInFlight = false;

export function setPostCurrentUser(user) {
  currentUser = user;
}

export function initPostActions() {
  if (postActionsAttached) return;
  postActionsAttached = true;
  document.addEventListener("click", async (event) => {
    const edit = event.target.closest(".post-edit");
    const remove = event.target.closest(".post-delete");
    if (edit) {
      event.preventDefault();
      edit.closest("details")?.removeAttribute("open");
      await editPost(edit.dataset.postId);
    } else if (remove) {
      event.preventDefault();
      await deletePost(remove.dataset.postId);
    }
  });
}

/**
 * Called once at page load. Wires the composer, loads page 1,
 * and wires the "Load more" button.
 */
export async function initFeed() {
  // Auth is already guaranteed by initAuth(), but we need the user object.
  // Cheap way: re-fetch it (result is cached by the browser? no—single call).
  const me = await api.get("/api/auth/me");
  currentUser = me.data.user;
  const composerAvatar = document.getElementById("composer-avatar");
  if (composerAvatar) composerAvatar.textContent = initials(currentUser.fullName);

  const input = document.getElementById("composer-input");
  const count = document.getElementById("composer-count");
  const submit = document.getElementById("composer-submit");

  input.addEventListener("input", () => {
    const n = input.value.length;
    count.textContent = `${n} / 2000`;
    submit.disabled = n === 0 || n > 2000;
  });

  submit.addEventListener("click", onCompose);

  initPostActions();

  document.getElementById("load-more").addEventListener("click", () => {
    currentPage += 1;
    loadFeed();
  });

  await loadFeed();
  window.setInterval(() => {
    if (document.visibilityState === "visible") refreshLatestPosts();
  }, FEED_REFRESH_INTERVAL_MS);
}

async function refreshLatestPosts() {
  if (feedRefreshInFlight) return;
  feedRefreshInFlight = true;
  try {
    const response = await api.get(`/api/posts?page=1&limit=${LIMIT}`);
    const { posts, pagination } = response.data;
    const feed = document.getElementById("feed");
    const existing = new Map(
      [...feed.querySelectorAll(":scope > .post")].map((card) => [card.dataset.postId, card])
    );
    const newPosts = [];

    for (const post of posts) {
      const oldCard = existing.get(post.id);
      if (!oldCard) {
        newPosts.push(post);
        continue;
      }

      const refreshedCard = renderPost(post);
      const oldComments = oldCard.querySelector(".comments-section");
      const newComments = refreshedCard.querySelector(".comments-section");
      if (oldComments && newComments) refreshedCard.replaceChild(oldComments, newComments);
      oldCard.replaceWith(refreshedCard);
    }

    for (const post of newPosts.reverse()) {
      const emptyState = feed.querySelector(":scope > .empty-state");
      emptyState?.remove();
      feed.prepend(renderPost(post));
    }

    totalPages = pagination.totalPages;
    document.getElementById("load-more").style.display = currentPage < totalPages ? "inline-block" : "none";
  } catch {
    // A transient poll failure should not replace usable feed content.
  } finally {
    feedRefreshInFlight = false;
  }
}

/**
 * Loads a page of the feed and appends (or replaces) posts.
 */
async function loadFeed() {
  const container = document.getElementById("feed");
  if (currentPage === 1) {
    container.innerHTML = `<div class="loading">Loading feed...</div>`;
  }

  try {
    const res = await api.get(`/api/posts?page=${currentPage}&limit=${LIMIT}`);
    const { posts, pagination } = res.data;
    totalPages = pagination.totalPages;

    if (currentPage === 1) container.innerHTML = "";

    if (posts.length === 0 && currentPage === 1) {
      container.innerHTML = `<div class="empty-state">No posts yet. Be the first to share something!</div>`;
    } else {
      for (const p of posts) container.appendChild(renderPost(p));
    }

    // Show/hide the Load more button
    const loadMore = document.getElementById("load-more");
    loadMore.style.display = currentPage < totalPages ? "inline-block" : "none";
    if (currentPage === 1) await focusPostFromQuery();
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Failed to load feed: ${escapeHtml(err.message)}</div>`;
  }
}

async function focusPostFromQuery() {
  const postId = new URLSearchParams(window.location.search).get("postId");
  if (!/^[a-f\d]{24}$/i.test(postId || "")) return;

  let postCard = document.querySelector(`.post[data-post-id="${postId}"]`);
  if (!postCard) {
    try {
      const response = await api.get(`/api/posts/${postId}`);
      postCard = renderPost(response.data.post);
      document.getElementById("feed").prepend(postCard);
    } catch {
      toast("This post is no longer available.", "error");
      return;
    }
  }

  postCard.classList.add("notification-target");
  requestAnimationFrame(() => postCard.scrollIntoView({ behavior: "smooth", block: "center" }));
}

/**
 * Renders a single post card (Section 6.5).
 * Returns a DOM element so callers can appendChild().
 */
export function renderPost(post) {
  const el = document.createElement("article");
  el.className = "post";
  el.dataset.postId = post.id;

  const authorId = post.author?.id || post.author?._id;
  const isOwner = currentUser && authorId === currentUser.id;
  const authorName = escapeHtml(post.author?.fullName || "Unknown");
  const authorUsername = escapeHtml(post.author?.username || "unknown");
  const content = escapeHtml(post.content);

  el.innerHTML = `
    <div class="post-header">
      <div class="post-identity">
        <div class="avatar avatar-small post-avatar" aria-hidden="true">${initials(post.author?.fullName || "?")}</div>
        <div class="post-author">
        <a class="post-author-name" href="/profile?username=${encodeURIComponent(authorUsername)}">${authorName}</a>
        <span class="post-author-username">@${authorUsername}</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px"><span class="post-time">${timeAgo(post.createdAt)}</span>
      ${isOwner ? `<details class="post-menu"><summary aria-label="Post options" title="Post options"><svg class="icon"><use href="/static/assets/icons.svg#i-more"></use></svg></summary><div class="post-menu-items"><button type="button" class="post-edit" data-post-id="${post.id}"><svg class="icon icon-sm"><use href="/static/assets/icons.svg#i-edit"></use></svg>Edit post</button><button type="button" class="post-delete danger-action" data-post-id="${post.id}"><svg class="icon icon-sm"><use href="/static/assets/icons.svg#i-trash"></use></svg>Delete post</button></div></details>` : ""}</div>
    </div>
    <div class="post-content">${content}</div>
    <div class="post-actions">
      ${currentUser ? `<button type="button" class="action-btn like-btn ${post.likedByMe ? "liked" : ""}" data-post-id="${post.id}" aria-label="${post.likedByMe ? "Unlike" : "Like"} post" aria-pressed="${Boolean(post.likedByMe)}"><svg class="icon icon-sm"><use href="/static/assets/icons.svg#i-heart"></use></svg><span class="like-count">${post.likeCount}</span></button>` : `<a class="action-btn" href="/login" aria-label="Sign in to like this post"><svg class="icon icon-sm"><use href="/static/assets/icons.svg#i-heart"></use></svg><span>${post.likeCount}</span></a>`}
      <button type="button" class="action-btn comments-toggle" data-post-id="${post.id}" aria-label="Show comments">
        <svg class="icon icon-sm"><use href="/static/assets/icons.svg#i-message"></use></svg><span class="comment-count">${post.commentCount}</span>
      </button>
    </div>
    <div class="comments-section" data-post-id="${post.id}" hidden></div>
  `;
  setAvatar(el.querySelector(".post-avatar"), post.author?.fullName, post.author?.avatarUrl);
  return el;
}

/**
 * Creates a new post from the composer input.
 */
async function onCompose() {
  const input = document.getElementById("composer-input");
  const submit = document.getElementById("composer-submit");
  const content = input.value.trim();

  if (!content) return;

  submit.disabled = true;
  submit.querySelector("span").textContent = "Publishing...";

  try {
    const res = await api.post("/api/posts", { content });

    // The create response does not include like/comment counts
    // (those are computed at read-time). Build a compatible shape.
    const newPost = {
      id: res.data.post.id,
      author: {
        id: currentUser.id,
        fullName: currentUser.fullName,
        username: currentUser.username,
        avatarUrl: currentUser.avatarUrl,
      },
      content: res.data.post.content,
      createdAt: res.data.post.createdAt,
      updatedAt: res.data.post.updatedAt,
      likeCount: 0,
      commentCount: 0,
      likedByMe: false,
    };

    const feed = document.getElementById("feed");
    // Remove empty state if present
    const empty = feed.querySelector(".empty-state");
    if (empty) empty.remove();
    // Insert at the top
    feed.insertBefore(renderPost(newPost), feed.firstChild);

    input.value = "";
    document.getElementById("composer-count").textContent = "0 / 2000";
    toast("Post published.", "success");
  } catch (err) {
    toast(err.message || "Failed to publish post.", "error");
  } finally {
    submit.disabled = input.value.trim().length === 0;
    submit.querySelector("span").textContent = "Publish";
  }
}

async function editPost(postId) {
  try {
    const result = await api.get(`/api/posts/${postId}`);
    const content = result.data.post.content;
    const values = await openFormDialog({
      title: "Edit post",
      submitLabel: "Save post",
      fields: [{ name: "content", label: "Post content", value: content, multiline: true, maxLength: 2000 }],
    });
    if (!values) return;
    const updated = await api.patch(`/api/posts/${postId}`, values);
    const card = document.querySelector(`.post[data-post-id="${postId}"]`);
    const contentNode = card?.querySelector(".post-content");
    if (contentNode) contentNode.textContent = updated.data.post.content;
    toast("Post updated.", "success");
  } catch (error) {
    toast(error.message || "Could not update this post.", "error");
  }
}

async function deletePost(postId) {
  if (!window.confirm("Delete this post? Its comments and likes will also be removed.")) return;
  try {
    await api.delete(`/api/posts/${postId}`);
    document.querySelector(`.post[data-post-id="${postId}"]`)?.remove();
    toast("Post deleted.", "success");
  } catch (error) {
    toast(error.message || "Could not delete this post.", "error");
  }
}

function initials(name) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}