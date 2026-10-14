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
const { Notification } = await import("../src/models/notification.model.js");
const { Post } = await import("../src/models/post.model.js");
const { User } = await import("../src/models/user.model.js");

let app;
let server;
let baseUrl;
let owner;
let actor;
let ownerCookie;
let actorCookie;
let postId;

async function register(username, fullName) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName,
      username,
      email: `${username}@example.test`,
      password: "NotificationTest123",
    }),
  });
  const body = await response.json();
  assert.equal(response.status, 201, body.message);
  return body.data.user;
}

async function login(username) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: username, password: "NotificationTest123" }),
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
  return { response, body: await response.json() };
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
  owner = await register(`notifyowner${suffix}`, "Notification Owner");
  actor = await register(`notifyactor${suffix}`, "Notification Actor");
  ownerCookie = await login(owner.username);
  actorCookie = await login(actor.username);

  const created = await request("/api/posts", {
    method: "POST",
    cookie: ownerCookie,
    body: { content: "Notification integration test post." },
  });
  assert.equal(created.response.status, 201);
  postId = created.body.data.post.id;
});

after(async () => {
  if (baseUrl && ownerCookie) await request("/api/auth/logout", { method: "POST", cookie: ownerCookie });
  if (baseUrl && actorCookie) await request("/api/auth/logout", { method: "POST", cookie: actorCookie });
  if (owner?.id && postId) await Post.deleteOne({ _id: postId });
  if (owner?.id && actor?.id) {
    await Comment.deleteMany({ author: { $in: [owner.id, actor.id] } });
    await Follow.deleteMany({ $or: [{ follower: owner.id }, { follower: actor.id }, { following: owner.id }, { following: actor.id }] });
    await Notification.deleteMany({ $or: [{ recipient: owner.id }, { recipient: actor.id }, { actor: owner.id }, { actor: actor.id }] });
    await Post.deleteMany({ author: { $in: [owner.id, actor.id] } });
    await User.deleteMany({ _id: { $in: [owner.id, actor.id] } });
  }
  if (server?.listening) {
    server.close();
    await once(server, "close");
  }
  if (app?.locals.sessionStore) await app.locals.sessionStore.close();
  await disconnectDatabase();
});

test("notifications cover social activity and recipient-owned read state", async () => {
  const unauthenticated = await request("/api/notifications");
  assert.equal(unauthenticated.response.status, 401);

  const like = await request(`/api/posts/${postId}/likes`, { method: "POST", cookie: actorCookie });
  assert.equal(like.response.status, 201);
  const duplicateLike = await request(`/api/posts/${postId}/likes`, { method: "POST", cookie: actorCookie });
  assert.equal(duplicateLike.response.status, 200);

  const comment = await request(`/api/posts/${postId}/comments`, {
    method: "POST",
    cookie: actorCookie,
    body: { content: "A notification test comment." },
  });
  assert.equal(comment.response.status, 201);

  const follow = await request(`/api/users/${owner.id}/follow`, { method: "POST", cookie: actorCookie });
  assert.equal(follow.response.status, 201);
  const duplicateFollow = await request(`/api/users/${owner.id}/follow`, { method: "POST", cookie: actorCookie });
  assert.equal(duplicateFollow.response.status, 200);

  const selfLike = await request(`/api/posts/${postId}/likes`, { method: "POST", cookie: ownerCookie });
  assert.equal(selfLike.response.status, 201);
  const inbox = await request("/api/notifications?page=1&limit=20", { cookie: ownerCookie });
  assert.equal(inbox.response.status, 200);
  assert.equal(inbox.body.data.unreadCount, 3);
  assert.deepEqual(inbox.body.data.notifications.map((item) => item.type).sort(), ["comment", "follow", "like"]);
  assert.ok(inbox.body.data.notifications.every((item) => item.actor.id === actor.id));
  assert.ok(inbox.body.data.notifications.find((item) => item.type === "like").href.includes(`postId=${postId}`));
  assert.equal(inbox.body.data.notifications.find((item) => item.type === "follow").href, `/profile?username=${actor.username}`);

  const notificationId = inbox.body.data.notifications[0].id;
  const forbiddenRead = await request(`/api/notifications/${notificationId}/read`, { method: "PATCH", cookie: actorCookie });
  assert.equal(forbiddenRead.response.status, 404);
  const read = await request(`/api/notifications/${notificationId}/read`, { method: "PATCH", cookie: ownerCookie });
  assert.equal(read.response.status, 200);
  const markAll = await request("/api/notifications/read-all", { method: "PATCH", cookie: ownerCookie });
  assert.equal(markAll.response.status, 200);
  assert.equal(markAll.body.data.updatedCount, 2);

  const cleared = await request("/api/notifications?page=1&limit=20", { cookie: ownerCookie });
  assert.equal(cleared.body.data.unreadCount, 0);

  const deletedPost = await request(`/api/posts/${postId}`, { method: "DELETE", cookie: ownerCookie });
  assert.equal(deletedPost.response.status, 200);
  const afterDelete = await request("/api/notifications?page=1&limit=20", { cookie: ownerCookie });
  assert.equal(afterDelete.body.data.pagination.total, 1);
  assert.equal(afterDelete.body.data.notifications[0].type, "follow");
});
