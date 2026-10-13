import dotenv from 'dotenv';
dotenv.config();

import {createApp} from './app.js';
import {connectDatabase} from './config/database.js';


const PORT = process.env.PORT || 5000;
async function startServer() {
    await connectDatabase();

    const app = createApp();
    
    const server = app.listen(PORT, () => {
        console.log(`[server] Server is running on port ${PORT}`);
    });
}

console.log(`[server] Environment: ${process.env.NODE_ENV || "development"}`);
console.log(`[server] Health check: http://localhost:${PORT}/api/health`);

const shutdown = async (signal) => {
    console.log(`\n[server] Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      const { disconnectDatabase } = await import("./config/database.js");
      await disconnectDatabase();
      process.exit(0);
    });
  };


    process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  startServer();