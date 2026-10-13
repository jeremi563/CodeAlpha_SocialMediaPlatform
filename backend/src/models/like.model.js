import mongoose from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";

const likeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Like must reference a user."],
    },

    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: [true, "Like must reference a post."],
    },
  },
  baseSchemaOptions
);

// Section 5.5 - One user can like a post only once
likeSchema.index({ user: 1, post: 1 }, { unique: true });

// Fast lookup: "who liked this post?" and "which posts did this user like?"
likeSchema.index({ post: 1 });
likeSchema.index({ user: 1 });

export const Like = mongoose.model("Like", likeSchema);