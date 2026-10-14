import assert from "node:assert/strict";
import test from "node:test";
import { api } from "../../frontend/js/api.js";

test("frontend API request serialization", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalFormData = globalThis.FormData;

  await t.test("preserves multipart FormData and leaves its content type to fetch", async () => {
    const form = new FormData();
    form.append("profilePicture", new Blob(["image-bytes"], { type: "image/png" }), "avatar.png");
    let requestOptions;
    globalThis.fetch = async (_url, options) => {
      requestOptions = options;
      return { status: 200, ok: true, json: async () => ({ success: true }) };
    };

    try {
      await api.post("/api/users/me/profile-picture", form);
      assert.equal(requestOptions.body, form);
      assert.equal(requestOptions.headers["Content-Type"], undefined);
      assert.equal(requestOptions.credentials, "same-origin");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test("continues to JSON-serialize ordinary request bodies", async () => {
    let requestOptions;
    globalThis.fetch = async (_url, options) => {
      requestOptions = options;
      return { status: 200, ok: true, json: async () => ({ success: true }) };
    };

    try {
      await api.post("/api/auth/login", { identifier: "test-user", password: "example" });
      assert.equal(requestOptions.headers["Content-Type"], "application/json");
      assert.deepEqual(JSON.parse(requestOptions.body), {
        identifier: "test-user",
        password: "example",
      });
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.FormData = originalFormData;
    }
  });
});
