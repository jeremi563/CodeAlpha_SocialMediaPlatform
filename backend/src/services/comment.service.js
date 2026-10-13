import { Comment } from "../models/comment.model.js";
import { Post } from "../models/post.model.js";
import { PAGINATION } from "../config/constants.js";

/**
 * Comment business logic: create, list, edit, delete.
 * Comments are leaves (no cascade on delete).
 * Post deletion cascades to comments (handled in post.service.js).
 */

/**
 * Creates a comment on a post.
 * Verifies the post exists first (Section 13.3 rule 14).
 * Author is derived from session (Section 11.5).
 */
export async function createComment({ postId, authorId, content }) {
  const postExists = await Post.exists({ _id: postId });
  if (!postExists) {
    const err = new Error("Post not found.");
    err.status = 404;
    throw err;
  }

  const comment = await Comment.create({
    post: postId,
    author: authorId,
    content,
  });

  // Populate author info for the response so the frontend can
  // render it without a second fetch.
  await comment.populate("author", "fullName username");

  return comment;
}

/**
 * Lists comments for a post, oldest first (Section 3.1 FR-07
 * "display comments in a consistent order").
 * Only fetches what the frontend needs: id, content, author, timestamps.
 */
export async function getPostComments(postId, { page, limit }) {
  const skip = (page - 1) * limit;

  const [comments, total] = await Promise.all([
    Comment.find({ post: postId })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "fullName username")
      .lean(),
    Comment.countDocuments({ post: postId }),
  ]);

  const shaped = comments.map((c) => ({
    id: c._id.toString(),
    post: c.post.toString(),
    author: c.author,
    content: c.content,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));

  return { comments: shaped, total };
}

/**
 * Updates a comment's content. Ownership enforced (Section 13.3 rule 17).
 * Returns the updated, populated comment. 404 if missing, 403 if not owner.
 */
export async function updateComment(commentId, userId, content) {
  const comment = await Comment.findById(commentId);
  if (!comment) return null;

  if (comment.author.toString() !== userId.toString()) {
    const err = new Error("You can only edit your own comments.");
    err.status = 403;
    throw err;
  }

  comment.content = content;
  await comment.save();
  await comment.populate("author", "fullName username");

  return comment;
}

/**
 * Deletes a comment. Ownership enforced.
 * Returns true if deleted, false if not found.
 */
export async function deleteComment(commentId, userId) {
  const comment = await Comment.findById(commentId).select("author");
  if (!comment) return false;

  if (comment.author.toString() !== userId.toString()) {
    const err = new Error("You can only delete your own comments.");
    err.status = 403;
    throw err;
  }

  await Comment.deleteOne({ _id: comment._id });
  return true;
}