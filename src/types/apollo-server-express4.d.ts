declare module '@apollo/server/express4' {
  import type { ApolloServer } from '@apollo/server';
  import type { RequestHandler } from 'express';

  export function expressMiddleware<TContext = any>(
    server: ApolloServer<TContext>,
    options?: {
      context?: (args: any) => Promise<TContext> | TContext;
    }
  ): RequestHandler;
}
