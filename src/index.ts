import express from 'express';

import cors from 'cors';

import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
    const app = express();

    // Apply middleware
    app.use(cors());
    app.use(express.json());

    // Health check
    app.get('/health', (_, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
    const server = app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });

    server.on('error', (err) => {
        console.error('Server encountered an error:', err);
        process.exit(1);
    });

}

startServer().catch((err) => {
    if (err instanceof Error) {
        console.error('Failed to start server:', err.message);
        console.error(err.stack);
    } else {
        console.error('Failed to start server:', err);
    }
    process.exit(1);
});