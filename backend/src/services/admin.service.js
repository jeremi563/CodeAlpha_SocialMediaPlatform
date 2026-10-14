import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { Notification } from "../models/notification.model.js";
import { Post } from "../models/post.model.js";
import { User } from "../models/user.model.js";

export async function getOverview() {
  const [users, suspendedUsers, posts, comments, unreadNotifications] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: false }),
    Post.countDocuments(),
    Comment.countDocuments(),
    Notification.countDocuments({ readAt: null }),
  ]);
  return { users, activeUsers: users - suspendedUsers, suspendedUsers, posts, comments, unreadNotifications };
}

export async function listUsers({ page, limit, query = "" }) {
  const filter = {};
  if (query) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { username: new RegExp(escaped, "i") },
      { fullName: new RegExp(escaped, "i") },
      { email: new RegExp(escaped, "i") },
    ];
  }
  const [users, total] = await Promise.all([
    User.find(filter)
      .select("fullName username email role isActive createdAt")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  return {
    users: users.map((user) => ({
      id: user._id.toString(),
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      role: user.role || "user",
      isActive: user.isActive !== false,
      createdAt: user.createdAt,
    })),
    total,
  };
}

export async function setUserActiveStatus(targetId, adminId, isActive) {
  const target = await User.findById(targetId).select("role isActive");
  if (!target) return null;

  if (target._id.toString() === adminId.toString() && !isActive) {
    const error = new Error("You cannot suspend your own administrator account.");
    error.status = 400;
    throw error;
  }

  if (target.role === "admin" && target.isActive && !isActive) {
    const activeAdmins = await User.countDocuments({ role: "admin", isActive: true });
    if (activeAdmins <= 1) {
      const error = new Error("The last active administrator cannot be suspended.");
      error.status = 409;
      throw error;
    }
  }

  target.isActive = isActive;
  await target.save();
  return { id: target._id.toString(), isActive: target.isActive };
}

export async function listPosts({ page, limit }) {
  const [posts, total] = await Promise.all([
    Post.find()
      .select("content author createdAt updatedAt")
      .populate("author", "fullName username")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Post.countDocuments(),
  ]);
  return {
    posts: posts.map((post) => ({
      id: post._id.toString(),
      content: post.content,
      author: post.author ? { id: post.author._id.toString(), fullName: post.author.fullName, username: post.author.username } : null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    })),
    total,
  };
}

export async function listComments({ page, limit }) {
  const [comments, total] = await Promise.all([
    Comment.find()
      .select("content author post createdAt updatedAt")
      .populate("author", "fullName username")
      .populate("post", "content")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Comment.countDocuments(),
  ]);
  return {
    comments: comments.map((comment) => ({
      id: comment._id.toString(),
      content: comment.content,
      author: comment.author ? { id: comment.author._id.toString(), fullName: comment.author.fullName, username: comment.author.username } : null,
      post: comment.post ? { id: comment.post._id.toString(), content: comment.post.content } : null,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    })),
    total,
  };
}

export async function deletePost(postId) {
  const post = await Post.findById(postId).select("_id");
  if (!post) return false;
  await Promise.all([
    Comment.deleteMany({ post: post._id }),
    Like.deleteMany({ post: post._id }),
    Notification.deleteMany({ post: post._id }),
  ]);
  await Post.deleteOne({ _id: post._id });
  return true;
}

export async function deleteComment(commentId) {
  if (!mongoose.Types.ObjectId.isValid(commentId)) return false;
  await Notification.deleteMany({ comment: commentId });
  const result = await Comment.deleteOne({ _id: commentId });
  return result.deletedCount > 0;
}
