import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test, { after, before } from "node:test";
import dotenv from "dotenv";
import sharp from "sharp";

const testDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(testDir, "../.env") });

const { createApp } = await import("../src/app.js");
const { connectDatabase, disconnectDatabase } = await import("../src/config/database.js");
const { User } = await import("../src/models/user.model.js");
const { Post } = await import("../src/models/post.model.js");
const { removeProfilePicture } = await import("../src/services/profile-picture.service.js");

let app;
let server;
let baseUrl;
let username;
let userId;
let cookie;
let png;

before(async () => {
  assert.ok(process.env.MONGODB_URI, "MONGODB_URI must be configured to run integration tests.");
  process.env.NODE_ENV = "test";
  await connectDatabase();

  app = createApp();
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const suffix = randomBytes(5).toString("hex");
  username = `picture${suffix}`;
  const registration = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Profile Picture Test",
      username,
      email: `${username}@example.test`,
      password: "ProfilePictureTest123",
    }),
  });
  const registered = await registration.json();
  assert.equal(registration.status, 201, registered.message);
  userId = registered.data.user.id;

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: username, password: "ProfilePictureTest123" }),
  });
  assert.equal(login.status, 200);
  cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, "Login should establish a session cookie.");

  png = await sharp({
    create: { width: 24, height: 16, channels: 3, background: "#34795e" },
  }).png().toBuffer();
});

after(async () => {
  if (userId) {
    await Post.deleteMany({ author: userId });
    await removeProfilePicture(userId);
    await User.deleteOne({ _id: userId });
  }
  if (server?.listening) {
    server.close();
    await once(server, "close");
  }
  if (app?.locals.sessionStore) await app.locals.sessionStore.close();
  await disconnectDatabase();
});

test("profile picture lifecycle", async (t) => {
  await t.test("upload requires authentication", async () => {
    const form = new FormData();
    form.append("profilePicture", new Blob([png], { type: "image/png" }), "avatar.png");
    const response = await fetch(`${baseUrl}/api/users/me/profile-picture`, { method: "POST", body: form });
    assert.equal(response.status, 401);
  });

  await t.test("rejects unsupported image formats", async () => {
    const form = new FormData();
    form.append("profilePicture", new Blob(["<svg></svg>"], { type: "image/svg+xml" }), "avatar.svg");
    const response = await fetch(`${baseUrl}/api/users/me/profile-picture`, {
      method: "POST",
      headers: { Cookie: cookie },
      body: form,
    });
    assert.equal(response.status, 415);
  });

  await t.test("normalizes upload, replaces prior image, and removes it", async () => {
    const upload = async (buffer) => {
      const form = new FormData();
      form.append("profilePicture", new Blob([buffer], { type: "image/png" }), "avatar.png");
      return fetch(`${baseUrl}/api/users/me/profile-picture`, {
        method: "POST",
        headers: { Cookie: cookie },
        body: form,
      });
    };

    const firstUpload = await upload(png);
    assert.equal(firstUpload.status, 200, (await firstUpload.clone().json()).message);
    const firstProfile = await fetch(`${baseUrl}/api/users/${username}`).then((response) => response.json());
    const firstAvatarUrl = firstProfile.data.user.avatarUrl;
    assert.ok(firstAvatarUrl);
    assert.equal(firstProfile.data.user.profilePictureId, undefined);
    assert.equal(firstProfile.data.user.email, undefined);

    const newPost = await fetch(`${baseUrl}/api/posts`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Avatar visible in other users' feeds." }),
    });
    assert.equal(newPost.status, 201);
    const newPostBody = await newPost.json();
    const feed = await fetch(`${baseUrl}/api/posts?page=1&limit=10`).then((response) => response.json());
    const feedPost = feed.data.posts.find((post) => post.id === newPostBody.data.post.id);
    assert.equal(feedPost.author.avatarUrl, firstAvatarUrl);

    const firstImage = await fetch(`${baseUrl}${firstAvatarUrl}`);
    assert.equal(firstImage.status, 200);
    assert.match(firstImage.headers.get("content-type"), /image\/webp/);
    const firstMetadata = await sharp(Buffer.from(await firstImage.arrayBuffer())).metadata();
    assert.deepEqual([firstMetadata.width, firstMetadata.height], [512, 512]);

    const replacement = await sharp({
      create: { width: 10, height: 30, channels: 3, background: "#b65f4f" },
    }).png().toBuffer();
    const secondUpload = await upload(replacement);
    assert.equal(secondUpload.status, 200, (await secondUpload.clone().json()).message);

    const secondProfile = await fetch(`${baseUrl}/api/users/${username}`).then((response) => response.json());
    assert.notEqual(secondProfile.data.user.avatarUrl, firstAvatarUrl);
    assert.equal((await fetch(`${baseUrl}${firstAvatarUrl}`)).status, 404);

    const removal = await fetch(`${baseUrl}/api/users/me/profile-picture`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    assert.equal(removal.status, 200);
    const removedProfile = await fetch(`${baseUrl}/api/users/${username}`).then((response) => response.json());
    assert.equal(removedProfile.data.user.avatarUrl, undefined);
    assert.equal((await fetch(`${baseUrl}${secondProfile.data.user.avatarUrl}`)).status, 404);
  });
});
