import mongoose from "mongoose";
import { User } from "../models/user.model.js";

const BUCKET_NAME = "profilePictures";

function getBucket() {
  if (!mongoose.connection.db) {
    throw new Error("The database is not connected.");
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME });
}

async function deletePicture(bucket, pictureId) {
  if (!pictureId) return;
  try {
    await bucket.delete(pictureId);
  } catch (error) {
    if (error.code !== "FileNotFound") throw error;
  }
}

export async function saveProfilePicture(userId, imageBuffer) {
  const bucket = getBucket();
  const upload = bucket.openUploadStream(`${userId}.webp`, {
    metadata: {
      contentType: "image/webp",
      ownerId: new mongoose.Types.ObjectId(userId),
    },
  });
  const previous = await User.findById(userId).select("profilePictureId");

  if (!previous) {
    upload.destroy();
    const error = new Error("User not found.");
    error.status = 404;
    throw error;
  }

  const completed = new Promise((resolve, reject) => {
    upload.once("finish", resolve);
    upload.once("error", reject);
  });
  upload.end(imageBuffer);
  let userUpdated = false;

  try {
    await completed;
    const updated = await User.findByIdAndUpdate(
      userId,
      { profilePictureId: upload.id },
      { returnDocument: "after", runValidators: true }
    );

    if (!updated) {
      await deletePicture(bucket, upload.id);
      const error = new Error("User not found.");
      error.status = 404;
      throw error;
    }

    userUpdated = true;
    await deletePicture(bucket, previous.profilePictureId).catch((error) => {
      console.error("[profile-picture] Failed to remove replaced image:", error.message);
    });
    return updated;
  } catch (error) {
    if (!userUpdated) {
      await deletePicture(bucket, upload.id).catch((cleanupError) => {
        console.error("[profile-picture] Failed to remove incomplete upload:", cleanupError.message);
      });
    }
    throw error;
  }
}

export async function removeProfilePicture(userId) {
  const user = await User.findById(userId).select("profilePictureId");
  if (!user) return null;

  const pictureId = user.profilePictureId;
  await User.updateOne({ _id: userId }, { $unset: { profilePictureId: 1 } });
  await deletePicture(getBucket(), pictureId);
  return true;
}

export async function openProfilePicture(pictureId) {
  if (!mongoose.Types.ObjectId.isValid(pictureId)) return null;
  const bucket = getBucket();
  const id = new mongoose.Types.ObjectId(pictureId);
  const file = await bucket.find({ _id: id }).next();
  if (!file || file.metadata?.contentType !== "image/webp") return null;
  return { file, stream: bucket.openDownloadStream(id) };
}