import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test, { after, before } from "node:test";
import dotenv from "dotenv";

const testDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(testDir, "../.env") });

const { createApp } = await import("../src/app.js");
const { connectDatabase, disconnectDatabase } = await import("../src/config/database.js");
const { Comment } = await import("../src/models/comment.model.js");
const { Follow } = await import("../src/models/follow.model.js");
const { Like } = await import("../src/models/like.model.js");
const { Notification } = await import("../src/models/notification.model.js");
const { Post } = await import("../src/models/post.model.js");
const { User } = await import("../src/models/user.model.js");

let app;
let server;
let baseUrl;
let user;
let otherUser;
let cookie;
let postId;
let commentId;

async function register(username, fullName, password = "DeletionTest123") {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName,
      username,
      email: `${username}@example.test`,
      password,
    }),
  });
  const body = await response.json();
  assert.equal(response.status, 201, body.message);
  return body.data.user;
}

async function login(username, password = "DeletionTest123") {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: username, password }),
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie")?.split(";")[0];
}

async function request(pathname, { method = "GET", cookie, body } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let bodyData;
  try {
    bodyData = await response.json();
  } catch {
    bodyData = null;
  }
  return { response, body: bodyData };
}

before(async () => {
  assert.ok(process.env.MONGODB_URI, "MONGODB_URI must be configured to run integration tests.");
  process.env.NODE_ENV = "test";
  await connectDatabase();
  app = createApp();
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const suffix = randomBytes(4).toString("hex");
  user = await register(`deleteme${suffix}`, "Delete Me User");
  otherUser = await register(`otheruser${suffix}`, "Other User");
  cookie = await login(user.username);

  // Create a post, comment, like, and follow to verify cascade deletion.
  const postResponse = await request("/api/posts", {
    method: "POST",
    cookie,
    body: { content: "Post that will be deleted with the account." },
  });
  assert.equal(postResponse.response.status, 201);
  postId = postResponse.body.data.post.id;

  const commentResponse = await request(`/api/posts/${postId}/comments`, {
    method: "POST",
    cookie,
    body: { content: "Comment that will be deleted with the account." },
  });
  assert.equal(commentResponse.response.status, 201);
  commentId = commentResponse.body.data.comment.id;

  const likeResponse = await request(`/api/posts/${postId}/likes`, {
    method: "POST",
    cookie,
  });
  assert.equal(likeResponse.response.status, 201);

  // User follows otherUser (not self-follow, which is prevented).
  const followResponse = await request(`/api/users/${otherUser.id}/follow`, {
    method: "POST",
    cookie,
  });
  assert.equal(followResponse.response.status, 201);
});

after(async () => {
  if (cookie) await request("/api/auth/logout", { method: "POST", cookie });
  if (user?.id) {
    await Promise.all([
      Comment.deleteMany({ author: user.id }),
      Follow.deleteMany({ $or: [{ follower: user.id }, { following: user.id }] }),
      Like.deleteMany({ user: user.id }),
      Notification.deleteMany({ $or: [{ recipient: user.id }, { actor: user.id }] }),
      Post.deleteMany({ author: user.id }),
      User.deleteOne({ _id: user.id }),
    ]);
  }
  if (otherUser?.id) {
    await Promise.all([
      Follow.deleteMany({ $or: [{ follower: otherUser.id }, { following: otherUser.id }] }),
      Notification.deleteMany({ $or: [{ recipient: otherUser.id }, { actor: otherUser.id }] }),
      User.deleteOne({ _id: otherUser.id }),
    ]);
  }
  if (server?.listening) {
    server.close();
    await once(server, "close");
  }
  if (app?.locals.sessionStore) await app.locals.sessionStore.close();
  await disconnectDatabase();
});

test("account deletion", async (t) => {
  await t.test("rejects anonymous requests", async () => {
    const response = await request("/api/users/me", { method: "DELETE" });
    assert.equal(response.response.status, 401);
  });

  await t.test("rejects missing password", async () => {
    const response = await request("/api/users/me", {
      method: "DELETE",
      cookie,
      body: {},
    });
    assert.equal(response.response.status, 400);
    assert.equal(response.body.success, false);
  });

  await t.test("rejects incorrect password", async () => {
    const response = await request("/api/users/me", {
      method: "DELETE",
      cookie,
      body: { password: "WrongPassword123" },
    });
    assert.equal(response.response.status, 403);
    assert.equal(response.body.success, false);
  });

  await t.test("deletes account and all associated data", async () => {
    const response = await request("/api/users/me", {
      method: "DELETE",
      cookie,
      body: { password: "DeletionTest123" },
    });
    assert.equal(response.response.status, 200);
    assert.equal(response.body.success, true);
    assert.ok(response.body.message.includes("deleted"));

    // User document is gone.
    assert.equal(await User.exists({ _id: user.id }), null);

    // Posts authored by the user are gone.
    assert.equal(await Post.exists({ _id: postId }), null);

    // Comments authored by the user are gone.
    assert.equal(await Comment.exists({ _id: commentId }), null);

    // Likes created by the user are gone.
    assert.equal(await Like.exists({ user: user.id }), null);

    // Follow relationships involving the user are gone.
    assert.equal(
      await Follow.exists({ $or: [{ follower: user.id }, { following: user.id }] }),
      null
    );

    // Notifications involving the user are gone.
    assert.equal(
      await Notification.exists({ $or: [{ recipient: user.id }, { actor: user.id }] }),
      null
    );

    // Public profile is no longer accessible.
    const profileResponse = await request(`/api/users/${user.username}`);
    assert.equal(profileResponse.response.status, 404);
  });

  await t.test("invalidates the session after deletion", async () => {
    // The session cookie should no longer work.
    const meResponse = await request("/api/auth/me", { cookie });
    assert.equal(meResponse.response.status, 401);
  });
});