import express from 'express';

export function createApp() {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.get('/api/health', (req, res) => {
        res.status(200).json({
            success: true,
            message:"Social Media Platform API is running successfully.",
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development'
        })
    })

    app.use((req,res) => {
        res.status(404).json({
            success: false,
            message: "Route not found"
        })
    })

    return app;
}