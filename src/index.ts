import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ApolloServer } from '@apollo/server';
import { resolvers } from './graphql/resolvers';
import { createContextFactory } from './context';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express4';
import { MCPServer } from './services/nlQueryService';

dotenv.config();

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  // Load GraphQL type definitions
  const typeDefs = readFileSync(join(__dirname, 'graphql', 'schema.graphql'), 'utf8');

  // Create Apollo Server
  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    introspection: true,
  });

  await apollo.start();

  app.use(cors());
  app.use(express.json());

  const mcpServer = new MCPServer(resolvers);

  app.use(
    '/graphql',
    expressMiddleware(apollo, {
      context: createContextFactory({ mcp: mcpServer }),
    })
  );

  app.post('/mcp/tools', async (req, res) => {
    try {
      const { tool, params } = req.body;
      const result = await mcpServer.handleToolCall(tool, params);
      res.json({ success: true, result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.get('/mcp/tools', (_req, res) => {
    const tools = mcpServer.getTools().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
    res.json({ tools });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
  await new Promise<void>((resolve) => httpServer.listen(PORT, resolve));

  console.log(`Server ready at http://localhost:${PORT}/graphql`);
  console.log(`MCP tools available at http://localhost:${PORT}/mcp/tools`);
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
