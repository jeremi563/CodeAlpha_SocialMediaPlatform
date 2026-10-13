import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import {createApp} from './app.js';
import {connectDatabase} from './config/database.js';

const PORT = process.env.PORT || 5000;
let server;
let app;

async function startServer() {
    await connectDatabase();

    app = createApp();
    server = app.listen(PORT, () => {
        console.log(`[server] Server is running on port ${PORT}`);
    });
}

console.log(`[server] Environment: ${process.env.NODE_ENV || "development"}`);
console.log(`[server] Health check: http://localhost:${PORT}/api/health`);

const shutdown = async (signal) => {
    console.log(`\n[server] Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      await app.locals.sessionStore.close();
      const { disconnectDatabase } = await import("./config/database.js");
      await disconnectDatabase();
      process.exit(0);
    });
  };


    process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer();