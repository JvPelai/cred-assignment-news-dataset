import { Router } from 'express';

export function healthRoutes() {
    const router = Router();

    router.get('/health', (_req, res) => {
        res.json({
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        });
    });

    return router;
}