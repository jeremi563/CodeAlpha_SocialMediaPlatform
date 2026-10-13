import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionMiddleware } from './config/session.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import postRoutes from './routes/post.routes.js';
import commentRoutes from './routes/comment.routes.js';
import followRoutes from './routes/follow.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');

export function createApp() {
    const app = express();

    if(process.env.NODE_ENV === 'production') {
        app.set('trust proxy', 1); // trust first proxy
    }
    app.use('/static', express.static(FRONTEND_DIR));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    const sessionMiddleware = createSessionMiddleware();
    app.use(sessionMiddleware);
    app.locals.sessionStore = sessionMiddleware.store;

    app.get('/api/health', (req, res) => {
        res.status(200).json({
            success: true,
            message:"Social Media Platform API is running successfully.",
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development'
        })
    })


    // Serve HTML pages
app.get("/", (req, res) => res.sendFile(path.join(FRONTEND_DIR, "index.html")));
app.get("/login", (req, res) => res.sendFile(path.join(FRONTEND_DIR, "login.html")));
app.get("/register", (req, res) => res.sendFile(path.join(FRONTEND_DIR, "register.html")));
app.get("/profile", (req, res) => res.sendFile(path.join(FRONTEND_DIR, "profile.html")));
app.get("/explore", (req, res) => res.sendFile(path.join(FRONTEND_DIR, "explore.html")));

    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/users', followRoutes);
    app.use('/api/posts', postRoutes);
    app.use('/api/posts', commentRoutes);
    app.use('/api/comments', commentRoutes);
  
    app.use((req,res) => {
        res.status(404).json({
            success: false,
            message: "Route not found"
        })
    })

    app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) {
      console.error("[error]", err);
    }
    res.status(status).json({
      success: false,
      message: err.message || "Internal server error.",

    });
})

    return app;
}