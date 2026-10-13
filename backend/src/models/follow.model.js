import mongoose from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";

const followSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Follow must reference a follower."],
    },

    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Follow must reference a followed user."],
    },
  },
  baseSchemaOptions
);


followSchema.path("following").validate(function (value) {
  if (!this.follower || !value) return true;
  return !this.follower.equals(value);
}, "A user cannot follow themselves.");

// Section 5.6 - Prevent duplicate follows
followSchema.index({ follower: 1, following: 1 }, { unique: true });

// Fast lookup: "who does this user follow?" and "who follows this user?"
followSchema.index({ follower: 1 });
followSchema.index({ following: 1 });

export const Follow = mongoose.model("Follow", followSchema);