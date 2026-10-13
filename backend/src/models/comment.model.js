import mongoose from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";
import { LIMITS } from "../config/constants.js";

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: [true, "Comment must reference a post."],
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Comment author is required."],
    },

    content: {
      type: String,
      required: [true, "Comment content is required."],
      trim: true,
      maxlength: [
        LIMITS.COMMENT_CONTENT_MAX,
        `Comment cannot exceed ${LIMITS.COMMENT_CONTENT_MAX} characters.`,
      ],
      validate: {
        validator: (value) => value && value.trim().length > 0,
        message: "Comment content cannot be empty.",
      },
    },
  },
  baseSchemaOptions
);

// Section 5.4 - Index for retrieving a post's comments in order
commentSchema.index({ post: 1, createdAt: 1 });

export const Comment = mongoose.model("Comment", commentSchema);