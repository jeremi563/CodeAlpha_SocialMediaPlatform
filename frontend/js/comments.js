import { api, escapeHtml, timeAgo, toast } from "/static/js/api.js";
import { openFormDialog } from "/static/js/dialog.js";
import { setAvatar } from "/static/js/avatars.js";

let currentUser = null;

export async function initComments() {
  // Wire click delegation for the comments toggle button
  document.addEventListener("click", async (e) => {
    const toggle = e.target.closest(".comments-toggle");
    if (toggle) {
      e.preventDefault();
      await toggleComments(toggle.dataset.postId);
      return;
    }

    const delBtn = e.target.closest(".comment-delete");
    if (delBtn) {
      e.preventDefault();
      await deleteComment(delBtn.dataset.commentId, delBtn.closest(".comments-section"));
      return;
    }

    const editBtn = e.target.closest(".comment-edit");
    if (editBtn) {
      e.preventDefault();
      await editComment(editBtn.dataset.commentId, editBtn.dataset.content, editBtn.closest(".comments-section"));
    }
  });

  // Wire submit delegation for the comment form
  document.addEventListener("submit", async (e) => {
    const form = e.target.closest(".comment-form");
    if (!form) return;
    e.preventDefault();
    await submitComment(form);
  });

  // Fetch current user once
  try {
    const res = await api.get("/api/auth/me");
    currentUser = res.data.user;
  } catch {
    currentUser = null;
  }
}

async function toggleComments(postId) {
  const section = document.querySelector(`.comments-section[data-post-id="${postId}"]`);
  if (!section) return;

  if (!section.hidden) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  section.innerHTML = `<div class="loading">Loading comments...</div>`;

  try {
    const res = await api.get(`/api/posts/${postId}/comments?limit=50`);
    renderComments(section, res.data.comments);
  } catch (err) {
    section.innerHTML = `<div class="empty-state">Failed to load comments.</div>`;
  }
}

function renderComments(section, comments) {
  const postId = section.dataset.postId;

  let html = "";
  if (comments.length === 0) {
    html += `<div class="empty-state" style="padding:12px;">No comments yet. Be the first!</div>`;
  } else {
    for (const c of comments) {
      const commentContent = escapeHtml(c.content);
      const isOwner = currentUser && c.author && (c.author.id || c.author._id) === currentUser.id;
      html += `
        <div class="comment">
          <div class="avatar avatar-small comment-avatar">${escapeHtml(String(c.author?.fullName || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase())}</div>
          <div class="comment-body">
            <div class="comment-author">${escapeHtml(c.author?.fullName || "Unknown")}</div>
            <div class="comment-content">${commentContent}</div>
            <div class="comment-meta">
              <span>${timeAgo(c.createdAt)}</span>
              ${isOwner ? `<button type="button" class="btn-link comment-edit" data-comment-id="${c.id}" data-content="${commentContent}">Edit</button><button type="button" class="btn-link comment-delete" data-comment-id="${c.id}">Delete</button>` : ""}
            </div>
          </div>
        </div>
      `;
    }
  }

  html += currentUser
    ? `<form class="comment-form" data-post-id="${postId}"><input type="text" name="content" placeholder="Add to the conversation..." maxlength="1000" required aria-label="Write a comment" /><button type="submit" class="btn btn-primary btn-small" aria-label="Send comment"><svg class="icon icon-sm"><use href="/static/assets/icons.svg#i-send"></use></svg></button></form>`
    : `<div class="comment-form"><a class="side-note" href="/login">Sign in to join the conversation.</a></div>`;

  section.innerHTML = html;
  section.querySelectorAll(".comment-avatar").forEach((avatar, index) => {
    setAvatar(avatar, comments[index]?.author?.fullName, comments[index]?.author?.avatarUrl);
  });
}

async function submitComment(form) {
  const postId = form.dataset.postId;
  const input = form.querySelector('input[name="content"]');
  const content = input.value.trim();
  if (!content) return;

  input.disabled = true;
  try {
    await api.post(`/api/posts/${postId}/comments`, { content });
    input.value = "";

    const section = form.closest(".comments-section");
    await loadComments(section);

    // Update the post's comment count in the UI
    const countEl = document.querySelector(`.comments-toggle[data-post-id="${postId}"] .comment-count`);
    if (countEl) {
      const n = parseInt(countEl.textContent, 10) || 0;
      countEl.textContent = n + 1;
    }
  } catch (err) {
    toast(err.message || "Failed to add comment.", "error");
  } finally {
    input.disabled = false;
  }
}

async function deleteComment(commentId, section) {
  if (!confirm("Delete this comment?")) return;
  try {
    await api.delete(`/api/comments/${commentId}`);
    // Reload comments
    const postId = section.dataset.postId;
    await loadComments(section);

    // Decrement count
    const countEl = document.querySelector(`.comments-toggle[data-post-id="${postId}"] .comment-count`);
    if (countEl) {
      const n = parseInt(countEl.textContent, 10) || 0;
      countEl.textContent = Math.max(0, n - 1);
    }
  } catch (err) {
    toast(err.message || "Failed to delete comment.", "error");
  }
}

async function editComment(commentId, currentContent, section) {
  const values = await openFormDialog({
    title: "Edit comment",
    submitLabel: "Save comment",
    fields: [{ name: "content", label: "Comment", value: currentContent, multiline: true, maxLength: 1000, rows: 3 }],
  });
  if (!values) return;
  try {
    await api.patch(`/api/comments/${commentId}`, values);
    if (section) await loadComments(section);
    toast("Comment updated.", "success");
  } catch (error) {
    toast(error.message || "Could not update this comment.", "error");
  }
}

async function loadComments(section) {
  if (!section) return;
  const result = await api.get(`/api/posts/${section.dataset.postId}/comments?limit=50`);
  renderComments(section, result.data.comments);
}