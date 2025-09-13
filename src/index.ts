import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { resolvers } from './graphql/resolvers';

dotenv.config();

async function startServer() {
  // Load GraphQL type definitions
  const typeDefs = readFileSync(join(__dirname, 'graphql', 'schema.graphql'), 'utf8');

  // Create Apollo Server
  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
  });
  const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
  const { url } = await startStandaloneServer(apollo, {
    listen: { port: PORT },
    context: async () => ({}),
  });
  console.log(`GraphQL endpoint ready at ${url}`);
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
