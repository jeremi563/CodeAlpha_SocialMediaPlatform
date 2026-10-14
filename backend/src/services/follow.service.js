import { Follow } from "../models/follow.model.js";
import { User } from "../models/user.model.js";
import { createNotificationSafely } from "./notification.service.js";

/**
 * Follow business logic.
 * Sections 13.5 rules 24-29 govern behavior:
 *   - Only authenticated users may follow (24)
 *   - No self-follow (25)
 *   - No duplicate follows (26)
 *   - A user may unfollow an account they follow (27)
 *   - A user cannot remove another user's follow (28)
 *   - Counts reflect actual relationships (29)
 *
 * Duplicate prevention is enforced by the compound unique index
 * {follower, following} from Phase 2, AND by a friendly pre-check.
 */

/**
 * Creates a follow relationship: followerId follows targetUserId.
 * Throws:
 *   - 404 if target user doesn't exist
 *   - 400 if attempting to follow self
 * Returns:
 *   - { created: true }  if a new relationship was created
 *   - { created: false } if the relationship already existed (idempotent)
 */
export async function followUser(followerId, targetUserId) {
  // Section 13.5 rule 25: cannot follow self
  if (followerId.toString() === targetUserId.toString()) {
    const err = new Error("You cannot follow yourself.");
    err.status = 400;
    throw err;
  }

  // Verify the target exists
  const targetExists = await User.exists({ _id: targetUserId });
  if (!targetExists) {
    const err = new Error("User not found.");
    err.status = 404;
    throw err;
  }

  try {
    await Follow.create({
      follower: followerId,
      following: targetUserId,
    });
    await createNotificationSafely({
      recipientId: targetUserId,
      actorId: followerId,
      type: "follow",
    });
    return { created: true };
  } catch (err) {
    if (err.code === 11000) {
      // Already following — unique index rejected the insert.
      // Section 13.5 rule 26.
      return { created: false };
    }
    throw err;
  }
}

/**
 * Removes a follow relationship that followerId created toward targetUserId.
 * Section 13.5 rule 28: only the follower can remove their own relationship.
 * (Enforced by scoping the delete to { follower: followerId, following: targetUserId }.)
 * Returns whether a relationship was actually removed.
 */
export async function unfollowUser(followerId, targetUserId) {
  const result = await Follow.deleteOne({
    follower: followerId,
    following: targetUserId,
  });
  return { deleted: result.deletedCount > 0 };
}

/**
 * Returns follow state between two users, plus the target's counts.
 * Used for immediate response after follow/unfollow, so the frontend
 * can update the button and counters without a full refetch.
 */
export async function getFollowState(followerId, targetUserId) {
  const [isFollowing, followerCount, followingCount] = await Promise.all([
    Follow.exists({ follower: followerId, following: targetUserId }).then(Boolean),
    Follow.countDocuments({ following: targetUserId }), // how many follow the target
    Follow.countDocuments({ follower: targetUserId }),  // how many the target follows
  ]);

  return { isFollowing, followerCount, followingCount };
}

/**
 * Checks whether followerId follows targetUserId.
 * Used by the profile endpoint to include "am I following this user?"
 * in the response.
 */
export async function isFollowing(followerId, targetUserId) {
  if (!followerId) return false;
  const exists = await Follow.exists({
    follower: followerId,
    following: targetUserId,
  });
  return Boolean(exists);
}