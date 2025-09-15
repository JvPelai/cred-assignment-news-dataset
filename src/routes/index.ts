import { Router } from 'express';
import { mcpRoutes } from './mcp';
import { healthRoutes } from './health';
import type { MCPServer } from '../services/nlQueryService';

export function createRoutes(mcp: MCPServer) {
    const router = Router();

    router.use(mcpRoutes(mcp));
    router.use(healthRoutes());

    // Optional root
    router.get('/', (_req, res) => res.json({ status: 'ok' }));

    return router;
}