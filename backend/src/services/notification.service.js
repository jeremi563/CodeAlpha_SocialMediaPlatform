import { Notification } from "../models/notification.model.js";

const ACTIVITY_LABELS = {
  like: "liked your post",
  comment: "commented on your post",
  follow: "started following you",
};

export async function createNotificationSafely({ recipientId, actorId, type, postId, commentId }) {
  if (!recipientId || !actorId || recipientId.toString() === actorId.toString()) return;

  try {
    await Notification.create({
      recipient: recipientId,
      actor: actorId,
      type,
      post: postId || null,
      comment: commentId || null,
    });
  } catch (error) {
    console.error("[notifications] Failed to record activity:", error.message);
  }
}

export async function getNotifications(userId, { page, limit }) {
  const skip = (page - 1) * limit;
  const filter = { recipient: userId };

  const [rows, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate("actor", "fullName username profilePictureId")
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, readAt: null }),
  ]);

  return {
    notifications: rows.map(toPublicNotification),
    total,
    unreadCount,
  };
}

export async function markNotificationRead(notificationId, userId) {
  const notification = await Notification.findOne({ _id: notificationId, recipient: userId });
  if (!notification) return false;
  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }
  return true;
}

export async function markAllNotificationsRead(userId) {
  const result = await Notification.updateMany(
    { recipient: userId, readAt: null },
    { $set: { readAt: new Date() } }
  );
  return result.modifiedCount;
}

function toPublicNotification(row) {
  const actor = row.actor
    ? {
        id: row.actor._id.toString(),
        fullName: row.actor.fullName,
        username: row.actor.username,
        ...(row.actor.profilePictureId
          ? { avatarUrl: `/api/users/${encodeURIComponent(row.actor.username)}/avatar/${row.actor.profilePictureId}` }
          : {}),
      }
    : null;
  const postId = row.post?.toString() || null;

  return {
    id: row._id.toString(),
    type: row.type,
    message: ACTIVITY_LABELS[row.type],
    actor,
    postId,
    commentId: row.comment?.toString() || null,
    href: row.type === "follow" && actor
      ? `/profile?username=${encodeURIComponent(actor.username)}`
      : postId
        ? `/?postId=${encodeURIComponent(postId)}`
        : "/",
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}
