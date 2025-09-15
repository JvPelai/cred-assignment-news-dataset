import { Router } from 'express';
import type { MCPServer } from '../services/nlQueryService';

type ExecBody = {
    tool: string;
    input?: unknown;
};

export function mcpRoutes(mcp: MCPServer) {
    const router = Router();

    // List available tools
    router.get('/mcp/tools', async (_req, res) => {
        try {
            const anyMcp = mcp as any;
            let tools: any = [];

            if (typeof anyMcp.listTools === 'function') {
                tools = await anyMcp.listTools();
            } else if (typeof anyMcp.getTools === 'function') {
                tools = await anyMcp.getTools();
            } else if (Array.isArray(anyMcp.tools)) {
                tools = anyMcp.tools;
            } else if (anyMcp.tools && typeof anyMcp.tools === 'object') {
                tools = Object.keys(anyMcp.tools).map((name) => ({ name, ...anyMcp.tools[name] }));
            }

            const normalized = (tools || []).map((t: any) => ({
                name: t?.name ?? t?.tool?.name ?? t?.id ?? 'unknown',
                description: t?.description ?? t?.tool?.description ?? null,
                inputSchema: t?.inputSchema ?? t?.schema ?? null,
            }));

            res.json({ tools: normalized });
        } catch (err: any) {
            res.status(500).json({ error: 'Failed to list MCP tools', detail: err?.message });
        }
    });

    // Debug endpoint to see available methods
    router.get('/mcp/debug', async (_req, res) => {
        try {
            const anyMcp = mcp as any;
            const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(anyMcp))
                .filter(name => typeof anyMcp[name] === 'function');
            const properties = Object.keys(anyMcp);
            
            res.json({ 
                methods,
                properties,
                constructor: anyMcp.constructor.name,
                hasHandleToolCall: typeof anyMcp.handleToolCall === 'function',
                hasExecuteTool: typeof anyMcp.executeTool === 'function',
                hasRunTool: typeof anyMcp.runTool === 'function',
                hasExecute: typeof anyMcp.execute === 'function'
            });
        } catch (err: any) {
            res.status(500).json({ error: 'Failed to debug MCP', detail: err?.message });
        }
    });

    // Execute a tool
    router.post('/mcp/execute', async (req, res) => {
        try {
            const { tool, input }: ExecBody = req.body || {};
            if (!tool) {
                return res.status(400).json({ error: "Missing 'tool' in request body" });
            }

            const anyMcp = mcp as any;
            let result;

            // Try the actual method that exists in your MCPServer
            if (typeof anyMcp.handleToolCall === 'function') {
                result = await anyMcp.handleToolCall(tool, input);
            } else if (typeof anyMcp.executeTool === 'function') {
                result = await anyMcp.executeTool(tool, input);
            } else if (typeof anyMcp.runTool === 'function') {
                result = await anyMcp.runTool(tool, input);
            } else if (typeof anyMcp.execute === 'function') {
                result = await anyMcp.execute(tool, input);
            } else {
                return res.status(500).json({ error: 'MCPServer has no tool execution method (handleToolCall/executeTool/runTool/execute)' });
            }

            return res.json({ tool, input, result });
        } catch (err: any) {
            return res.status(500).json({ error: 'Failed to execute MCP tool', detail: err?.message });
        }
    });

    return router;
}