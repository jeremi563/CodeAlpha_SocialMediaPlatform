import express from 'express';
import { createSessionMiddleware } from './config/session.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import postRoutes from './routes/post.routes.js';
import commentRoutes from './routes/comment.routes.js';

export function createApp() {
    const app = express();

    if(process.env.NODE_ENV === 'production') {
        app.set('trust proxy', 1); // trust first proxy
    }
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(createSessionMiddleware());

    app.get('/api/health', (req, res) => {
        res.status(200).json({
            success: true,
            message:"Social Media Platform API is running successfully.",
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development'
        })
    })

    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
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