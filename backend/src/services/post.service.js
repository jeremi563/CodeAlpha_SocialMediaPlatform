import mongoose from "mongoose";
import { Post } from "../models/post.model.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { Notification } from "../models/notification.model.js";
import { PAGINATION } from "../config/constants.js";

/**
 * Post business logic: create, read (feed + single), update, delete.
 * Deletion cascades to Comments and Likes (Section 5.10).
 */

/**
 * Creates a new post owned by authorId.
 * Section 13.2 rule 8: every post must have an author.
 * Author is derived from session, never from request body (Section 11.5).
 */
export async function createPost({ authorId, content }) {
  const post = await Post.create({ author: authorId, content });
  return post;
}

/**
 * Retrieves the main feed — recent posts from all users, newest first.
 * Section 9.3: returns author info, like count, comment count, and
 * whether the current user has liked each post.
 * Section 3.1 FR-05: reverse chronological, paginated.
 */
export async function getFeed({ page, limit, currentUserId = null }) {
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "fullName username profilePictureId")
      .lean(),
    Post.countDocuments(),
  ]);

  // Enrich each post with like count, comment count, and current-user like state.
  const enriched = await enrichPosts(posts, currentUserId);

  return { posts: enriched, total };
}

/**
 * Retrieves a single post by id. Returns null if not found.
 */
export async function getPostById(postId, currentUserId = null) {
  const post = await Post.findById(postId)
    .populate("author", "fullName username profilePictureId")
    .lean();

  if (!post) return null;

  const [enriched] = await enrichPosts([post], currentUserId);
  return enriched;
}

/**
 * Updates a post's content.
 * Ownership is enforced here (Section 13.2 rule 11).
 * Returns the updated document, or null if not found.
 * Throws with status 403 if the caller is not the author.
 */
export async function updatePost(postId, userId, content) {
  const post = await Post.findById(postId);
  if (!post) return null;

  if (post.author.toString() !== userId.toString()) {
    const err = new Error("You can only edit your own posts.");
    err.status = 403;
    throw err;
  }

  post.content = content;
  await post.save(); // runs schema validators on change

  // Re-fetch with populate to return the same shape as getPostById
  return getPostById(post._id, userId);
}

/**
 * Deletes a post and cascades to its Comments and Likes (Section 5.10).
 * Ownership enforced before deletion.
 * Returns true if deleted, false if not found.
 * Throws with status 403 if caller is not the author.
 */
export async function deletePost(postId, userId) {
  const post = await Post.findById(postId).select("author");
  if (!post) return false;

  if (post.author.toString() !== userId.toString()) {
    const err = new Error("You can only delete your own posts.");
    err.status = 403;
    throw err;
  }

  // Cascade (Section 5.10).
  // Order: delete dependent records first, then the post itself.
  // If the server crashes mid-operation, we prefer orphaned posts
  // over orphaned comments/likes referencing a missing post.
  await Promise.all([
    Comment.deleteMany({ post: post._id }),
    Like.deleteMany({ post: post._id }),
    Notification.deleteMany({ post: post._id }),
  ]);

  await Post.deleteOne({ _id: post._id });
  return true;
}

/**
 * Enriches an array of post objects with interaction metadata.
 * Runs efficiently: two batched queries regardless of how many posts.
 *
 * For each post, adds:
 *   - likeCount: total number of likes
 *   - commentCount: total number of comments
 *   - likedByMe: whether currentUserId has liked it (false if unauthenticated)
 */
async function enrichPosts(posts, currentUserId) {
  if (posts.length === 0) return [];

  const postIds = posts.map((p) => p._id);

  // 1. Like counts per post via a single aggregation.
  //    Group by post, count docs. Returns [{_id: postId, count: n}]
  const likeAgg = await Like.aggregate([
    { $match: { post: { $in: postIds } } },
    { $group: { _id: "$post", count: { $sum: 1 } } },
  ]);
  const likeCountMap = new Map(likeAgg.map((r) => [r._id.toString(), r.count]));

  // 2. Comment counts per post
  const commentAgg = await Comment.aggregate([
    { $match: { post: { $in: postIds } } },
    { $group: { _id: "$post", count: { $sum: 1 } } },
  ]);
  const commentCountMap = new Map(
    commentAgg.map((r) => [r._id.toString(), r.count])
  );

  // 3. Which posts did current user like? Single query.
  let likedSet = new Set();
  if (currentUserId) {
    const myLikes = await Like.find({
      user: currentUserId,
      post: { $in: postIds },
    })
      .select("post")
      .lean();
    likedSet = new Set(myLikes.map((l) => l.post.toString()));
  }

  // 4. Attach the metadata to each post.
  return posts.map((post) => {
    const idStr = post._id.toString();
    return {
      id: idStr,
      author: toPublicAuthor(post.author),
      content: post.content,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      likeCount: likeCountMap.get(idStr) || 0,
      commentCount: commentCountMap.get(idStr) || 0,
      likedByMe: likedSet.has(idStr),
    };
  });
}

function toPublicAuthor(author) {
  if (!author) return null;
  const result = {
    id: author._id.toString(),
    fullName: author.fullName,
    username: author.username,
  };
  if (author.profilePictureId) {
    result.avatarUrl = `/api/users/${encodeURIComponent(author.username)}/avatar/${author.profilePictureId}`;
  }
  return result;
}