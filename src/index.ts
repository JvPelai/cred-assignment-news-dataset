import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ApolloServer } from '@apollo/server';
import { resolvers } from './graphql/resolvers';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express4';

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

  // GraphQL endpoint
  app.use(
    '/graphql',
    expressMiddleware(apollo, {
      context: async () => ({}), // or createContext()
    })
  );
  // Apply Express middleware
  const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
  await new Promise<void>((resolve) => httpServer.listen(PORT, resolve));

  console.log(`Server ready at http://localhost:${PORT}/graphql`);
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
