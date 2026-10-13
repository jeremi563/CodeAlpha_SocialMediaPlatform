import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { User } from "../src/models/user.model.js";
import { Post } from "../src/models/post.model.js";
import { Comment } from "../src/models/comment.model.js";
import { Like } from "../src/models/like.model.js";
import { Follow } from "../src/models/follow.model.js";

async function run() {
  await connectDatabase();

  const models = { User, Post, Comment, Like, Follow };

  for (const [name, Model] of Object.entries(models)) {
    await Model.init(); // ensures indexes are created
    const indexes = await Model.collection.indexes();
    console.log(`\n${name} (${Model.collection.name}):`);
    indexes.forEach((idx) => {
      console.log(`  - ${JSON.stringify(idx.key)}${idx.unique ? " [unique]" : ""}`);
    });
  }

  await disconnectDatabase();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});