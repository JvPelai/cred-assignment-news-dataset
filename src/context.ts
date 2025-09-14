import type { Request } from 'express';
import DataLoader from 'dataloader';
import { prisma } from './lib/prisma';
import { MCPServer } from './services/nlQueryService';

// DataLoaders for N+1 query prevention
const createCategoryLoader = () =>
  new DataLoader(async (ids: readonly string[]) => {
    const categories = await prisma.category.findMany({
      where: { id: { in: [...ids] } },
    });
    return ids.map((id) => categories.find((cat) => cat.id === id));
  });

const createTagsLoader = () =>
  new DataLoader(async (articleIds: readonly string[]) => {
    const articles = await prisma.article.findMany({
      where: { id: { in: [...articleIds] } },
      include: { tags: true },
    });
    return articleIds.map((id) => articles.find((a) => a.id === id)?.tags || []);
  });

export type Context = {
  prisma: typeof prisma;
  mcp: MCPServer;
  req: Request;
  categoryLoader: DataLoader<string, any>;
  tagsLoader: DataLoader<string, any>;
};

export function createContextFactory(deps: { mcp: MCPServer }) {
  return async ({ req }: { req: Request }): Promise<Context> => ({
    prisma,
    mcp: deps.mcp,
    req,
    categoryLoader: createCategoryLoader(),
    tagsLoader: createTagsLoader(),
  });
}
