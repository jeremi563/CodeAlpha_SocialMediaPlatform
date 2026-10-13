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
const { User } = await import("../src/models/user.model.js");

let server;
let app;
let baseUrl;
let username;
let userId;

before(async () => {
  assert.ok(process.env.MONGODB_URI, "MONGODB_URI must be configured to run API tests.");
  process.env.NODE_ENV ??= "test";

  await connectDatabase();
  app = createApp();
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const suffix = randomBytes(5).toString("hex");
  username = `phase9${suffix}`;
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Phase Nine Regression User",
      username,
      email: `${username}@example.test`,
      password: "Phase9Regression123",
    }),
  });
  const body = await response.json();
  assert.equal(response.status, 201, body.message);
  userId = body.data.user.id;
});

after(async () => {
  if (userId) await User.deleteOne({ _id: userId });
  if (app?.locals.sessionStore) await app.locals.sessionStore.close();
  if (server?.listening) {
    server.close();
    await once(server, "close");
  }
  await disconnectDatabase();
});

test("Phase 9 API regression checks", async (t) => {
  await t.test("anonymous public profile omits email and password hash", async () => {
    const response = await fetch(`${baseUrl}/api/users/${username}`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.user.username, username);
    assert.equal(body.data.user.email, undefined);
    assert.equal(body.data.user.passwordHash, undefined);
    assert.equal(body.data.stats.isFollowing, false);
  });

  await t.test("protected user operations reject anonymous requests", async () => {
    const searchResponse = await fetch(`${baseUrl}/api/users/search?q=phase`);
    const updateResponse = await fetch(`${baseUrl}/api/users/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "Unauthorized update" }),
    });

    assert.equal(searchResponse.status, 401);
    assert.equal(updateResponse.status, 401);
    assert.equal((await searchResponse.json()).success, false);
    assert.equal((await updateResponse.json()).success, false);
  });

  await t.test("invalid resource IDs and pagination are rejected", async () => {
    const postResponse = await fetch(`${baseUrl}/api/posts/not-an-object-id`);
    const paginationResponse = await fetch(`${baseUrl}/api/posts?page=0&limit=500`);

    assert.equal(postResponse.status, 400);
    assert.equal(paginationResponse.status, 400);
    assert.equal((await postResponse.json()).success, false);
    assert.equal((await paginationResponse.json()).success, false);
  });

  await t.test("unknown API paths return a consistent JSON 404", async () => {
    const response = await fetch(`${baseUrl}/api/phase9-not-a-route`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(body, { success: false, message: "Route not found" });
  });
});
