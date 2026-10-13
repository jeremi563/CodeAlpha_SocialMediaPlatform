import mongoose from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";
import { LIMITS } from "../config/constants.js";

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Post author is required."],
      index: true,
    },

    content: {
      type: String,
      required: [true, "Post content is required."],
      trim: true,
      maxlength: [LIMITS.POST_CONTENT_MAX, `Post content cannot exceed ${LIMITS.POST_CONTENT_MAX} characters.`],
      validate: {
        validator: (value) => value && value.trim().length > 0,
        message: "Post content cannot be empty.",
      },
    },
  },
  baseSchemaOptions
);

// Section 5.3 - Indexes
// 1. Author + createdAt (for a user's own posts feed)
postSchema.index({ author: 1, createdAt: -1 });
// 2. createdAt alone (for the global chronological feed)
postSchema.index({ createdAt: -1 });

export const Post = mongoose.model("Post", postSchema);