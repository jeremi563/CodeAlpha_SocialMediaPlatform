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
const { hashPassword } = await import("../src/services/auth.service.js");
const { Comment } = await import("../src/models/comment.model.js");
const { Follow } = await import("../src/models/follow.model.js");
const { Like } = await import("../src/models/like.model.js");
const { Notification } = await import("../src/models/notification.model.js");
const { Post } = await import("../src/models/post.model.js");
const { User } = await import("../src/models/user.model.js");

let app;
let server;
let baseUrl;
let admin;
let member;
let regular;
let adminCookie;
let memberCookie;
let regularCookie;
let postId;
let commentId;

async function login(username, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: username, password }),
  });
  const body = await response.json();
  return { response, body, cookie: response.headers.get("set-cookie")?.split(";")[0] };
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
  assert.ok(process.env.MONGODB_URI, "MONGODB_URI must be configured to run admin integration tests.");
  process.env.NODE_ENV = "test";
  await connectDatabase();
  app = createApp();
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const suffix = randomBytes(4).toString("hex");
  const passwordHash = await hashPassword("AdminTestPassword123");
  [admin, member, regular] = await User.create([
    { fullName: "Admin Integration", username: `admin${suffix}`, email: `admin${suffix}@example.test`, passwordHash, role: "admin" },
    { fullName: "Member Integration", username: `member${suffix}`, email: `member${suffix}@example.test`, passwordHash },
    { fullName: "Regular Integration", username: `regular${suffix}`, email: `regular${suffix}@example.test`, passwordHash },
  ]);
  adminCookie = (await login(admin.username, "AdminTestPassword123")).cookie;
  memberCookie = (await login(member.username, "AdminTestPassword123")).cookie;
  regularCookie = (await login(regular.username, "AdminTestPassword123")).cookie;
  assert.ok(adminCookie);
  assert.ok(memberCookie);
  assert.ok(regularCookie);
});

after(async () => {
  if (memberCookie) await request("/api/auth/logout", { method: "POST", cookie: memberCookie });
  if (regularCookie) await request("/api/auth/logout", { method: "POST", cookie: regularCookie });
  if (adminCookie) await request("/api/auth/logout", { method: "POST", cookie: adminCookie });
  if (postId) {
    await Comment.deleteMany({ post: postId });
    await Like.deleteMany({ post: postId });
    await Notification.deleteMany({ post: postId });
    await Post.deleteOne({ _id: postId });
  }
  const ids = [admin?._id, member?._id, regular?._id].filter(Boolean);
  if (ids.length) {
    await Promise.all([
      Comment.deleteMany({ author: { $in: ids } }),
      Follow.deleteMany({ $or: [{ follower: { $in: ids } }, { following: { $in: ids } }] }),
      Notification.deleteMany({ $or: [{ recipient: { $in: ids } }, { actor: { $in: ids } }] }),
      Post.deleteMany({ author: { $in: ids } }),
      User.deleteMany({ _id: { $in: ids } }),
    ]);
  }
  if (server?.listening) {
    server.close();
    await once(server, "close");
  }
  if (app?.locals.sessionStore) await app.locals.sessionStore.close();
  await disconnectDatabase();
});

test("admin access, account management, and content moderation", async (t) => {
  await t.test("requires an active administrator role and blocks public role escalation", async () => {
    const anonymous = await request("/api/admin/overview");
    assert.equal(anonymous.response.status, 401);

    const forbidden = await request("/api/admin/overview", { cookie: memberCookie });
    assert.equal(forbidden.response.status, 403);

    const registration = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "No Role Escalation",
        username: `norole${randomBytes(3).toString("hex")}`,
        email: `norole${randomBytes(3).toString("hex")}@example.test`,
        password: "RoleEscalationTest123",
        role: "admin",
        isActive: false,
      }),
    });
    const registered = await registration.json();
    assert.equal(registration.status, 201);
    assert.equal(registered.data.user.role, "user");
    assert.equal(registered.data.user.isActive, true);
    const publicProfile = await request(`/api/users/${registered.data.user.username}`);
    assert.equal(publicProfile.body.data.user.role, undefined);
    assert.equal(publicProfile.body.data.user.isActive, undefined);

    const registeredLogin = await login(registered.data.user.username, "RoleEscalationTest123");
    const profileUpdate = await request("/api/users/me", {
      method: "PATCH",
      cookie: registeredLogin.cookie,
      body: { fullName: "No Role Escalation Updated", role: "admin", isActive: false },
    });
    assert.equal(profileUpdate.response.status, 200);
    assert.equal(profileUpdate.body.data.user.role, "user");
    assert.equal(profileUpdate.body.data.user.isActive, true);
    await request("/api/auth/logout", { method: "POST", cookie: registeredLogin.cookie });
    await User.deleteOne({ _id: registered.data.user.id });
  });

  await t.test("serves overview and account records without password hashes", async () => {
    const overview = await request("/api/admin/overview", { cookie: adminCookie });
    assert.equal(overview.response.status, 200);
    assert.ok(overview.body.data.users >= 3);
    assert.ok("activeUsers" in overview.body.data);

    const users = await request("/api/admin/users?page=1&limit=20", { cookie: adminCookie });
    assert.equal(users.response.status, 200);
    const listedAdmin = users.body.data.users.find((user) => user.id === admin.id);
    assert.equal(listedAdmin.role, "admin");
    assert.equal(listedAdmin.passwordHash, undefined);
  });

  await t.test("protects administrator accounts and suspends active sessions", async () => {
    const selfSuspend = await request(`/api/admin/users/${admin.id}/status`, {
      method: "PATCH", cookie: adminCookie, body: { isActive: false },
    });
    assert.equal(selfSuspend.response.status, 400);

    const suspend = await request(`/api/admin/users/${regular.id}/status`, {
      method: "PATCH", cookie: adminCookie, body: { isActive: false },
    });
    assert.equal(suspend.response.status, 200);
    const existingSession = await request("/api/auth/me", { cookie: regularCookie });
    assert.equal(existingSession.response.status, 401);

    const inactiveLogin = await login(regular.username, "AdminTestPassword123");
    assert.equal(inactiveLogin.response.status, 401);
    const reactivated = await request(`/api/admin/users/${regular.id}/status`, {
      method: "PATCH", cookie: adminCookie, body: { isActive: true },
    });
    assert.equal(reactivated.response.status, 200);
  });

  await t.test("allows administrators to moderate posts and comments", async () => {
    const postResponse = await request("/api/posts", {
      method: "POST", cookie: memberCookie, body: { content: "Post for admin moderation." },
    });
    assert.equal(postResponse.response.status, 201);
    postId = postResponse.body.data.post.id;

    const commentResponse = await request(`/api/posts/${postId}/comments`, {
      method: "POST", cookie: memberCookie, body: { content: "Comment for admin moderation." },
    });
    assert.equal(commentResponse.response.status, 201);
    commentId = commentResponse.body.data.comment.id;

    const comments = await request("/api/admin/comments?page=1&limit=20", { cookie: adminCookie });
    assert.equal(comments.response.status, 200);
    assert.ok(comments.body.data.comments.some((comment) => comment.id === commentId));

    const removedComment = await request(`/api/admin/comments/${commentId}`, { method: "DELETE", cookie: adminCookie });
    assert.equal(removedComment.response.status, 200);

    const posts = await request("/api/admin/posts?page=1&limit=20", { cookie: adminCookie });
    assert.equal(posts.response.status, 200);
    assert.ok(posts.body.data.posts.some((post) => post.id === postId));

    const removedPost = await request(`/api/admin/posts/${postId}`, { method: "DELETE", cookie: adminCookie });
    assert.equal(removedPost.response.status, 200);
    assert.equal(await Post.exists({ _id: postId }), null);
    postId = null;
  });
});
