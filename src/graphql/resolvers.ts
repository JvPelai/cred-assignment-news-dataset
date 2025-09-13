import { GraphQLScalarType, Kind, type ValueNode } from 'graphql';
import { prisma } from '../lib/prisma';

// Minimal JSON scalar to satisfy schema reference
function parseAst(ast: ValueNode): any {
  switch (ast.kind) {
    case Kind.NULL:
      return null;
    case Kind.STRING:
      return ast.value;
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.LIST:
      return ast.values.map((v) => parseAst(v));
    case Kind.OBJECT: {
      const obj: Record<string, any> = {};
      for (const field of ast.fields) {
        obj[field.name.value] = parseAst(field.value);
      }
      return obj;
    }
    default:
      return null;
  }
}

export const JSONScalar: GraphQLScalarType = new GraphQLScalarType({
  name: 'JSON',
  description: 'Arbitrary JSON value',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: (ast) => parseAst(ast),
});

export const resolvers = {
  JSON: JSONScalar,
  Query: {
    // Get all articles with basic fields
    async articles() {
      return prisma.article.findMany({
        take: 10,
        orderBy: { publishedAt: 'desc' },
      });
    },

    // Get all categories
    async categories() {
      return prisma.category.findMany({ orderBy: { name: 'asc' } });
    },
  },

  Article: {
    // Return the category for an article
    category(parent: { categoryId: string }) {
      return prisma.category.findUnique({ where: { id: parent.categoryId } });
    },
    
    // Simple computed fields with static values for now
    engagementScore() {
      return 1.5;
    },
    contentQuality() {
      return { score: 0.8, readability: 'Good', completeness: 'High' };
    },
    relatedArticles() {
      return [];
    },
  },

  Category: {
    // Return articles count for a category
    async articleCount(parent: { id: string }) {
      return prisma.article.count({ where: { categoryId: parent.id } });
    },
    
    // Return empty arrays for now
    articles() {
      return [];
    },
  },

  Tag: {
    // Return empty arrays for now
    articles() {
      return [];
    },
    async articleCount() {
      return 0;
    },
  },
};

export type Resolvers = typeof resolvers;
