import { Like } from "../models/like.model.js";
import { Post } from "../models/post.model.js";

/**
 * Like business logic: like, unlike.
 * Duplicate prevention is enforced by the compound unique index
 * (Section 5.5) AND by a pre-check here for a friendlier response.
 */

/**
 * Likes a post. Idempotent — if the like already exists, returns
 * the current state without creating a duplicate.
 * Section 13.4 rules 19-20.
 */
export async function likePost(postId, userId) {
  const postExists = await Post.exists({ _id: postId });
  if (!postExists) {
    const err = new Error("Post not found.");
    err.status = 404;
    throw err;
  }

  try {
    await Like.create({ user: userId, post: postId });
    return { created: true };
  } catch (err) {
    if (err.code === 11000) {
      // Already liked — compound unique index rejected the insert.
      // Section 13.4 rule 20: a user may like a post only once.
      return { created: false };
    }
    throw err;
  }
}

/**
 * Unlikes a post. Idempotent — returns whether a like was removed.
 * Section 13.4 rule 21: a user may remove their own like.
 * Section 13.4 rule 22: a user may not remove another user's like.
 * (Both enforced by scoping the delete to { user, post }.)
 */
export async function unlikePost(postId, userId) {
  const result = await Like.deleteOne({ user: userId, post: postId });
  return { deleted: result.deletedCount > 0 };
}

/**
 * Returns counts for a single post — useful for immediate response
 * after like/unlike so the frontend can update without a full refetch.
 */
export async function getPostLikeState(postId, userId) {
  const [likeCount, likedByMe] = await Promise.all([
    Like.countDocuments({ post: postId }),
    userId
      ? Like.exists({ user: userId, post: postId }).then(Boolean)
      : Promise.resolve(false),
  ]);
  return { likeCount, likedByMe };
}