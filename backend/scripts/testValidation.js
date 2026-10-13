import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { User } from "../src/models/user.model.js";
import { Like } from "../src/models/like.model.js";

async function run() {
  await connectDatabase();

  // 1. Username normalization
  const u = new User({
    fullName: "John Mwangi",
    username: "JohnMwangi",     // uppercase
    email: "John@Example.COM",   // mixed case
    passwordHash: "fakehash",
  });
  console.log("Normalized username:", u.username); // johnmwangi
  console.log("Normalized email:   ", u.email);    // john@example.com

  // 2. Empty-whitespace post content should fail
  const { Post } = await import("../src/models/post.model.js");
  const badPost = new Post({ author: u._id, content: "   " });
  try {
    await badPost.validate();
    console.log("ERROR: whitespace post passed validation");
  } catch (err) {
    console.log("Whitespace post correctly rejected:", err.message);
  }

  // 3. Self-follow should fail
  const { Follow } = await import("../src/models/follow.model.js");
  const selfFollow = new Follow({ follower: u._id, following: u._id });
  try {
    await selfFollow.validate();
    console.log("ERROR: self-follow passed validation");
  } catch (err) {
    console.log("Self-follow correctly rejected:", err.message);
  }

  await disconnectDatabase();
}

run().catch((err) => { console.error(err); process.exit(1); });