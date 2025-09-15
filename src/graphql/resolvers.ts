// src/graphql/resolvers.ts
import { PrismaClient } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { calculateEngagementScore, analyzeContentQuality } from '../utils/metrics';

const prisma = new PrismaClient();

export const resolvers = {
  Query: {
    article: async (_: any, args: { id?: string; slug?: string }) => {
      if (!args.id && !args.slug) {
        throw new GraphQLError('Either id or slug must be provided');
      }

      return prisma.article.findUnique({
        where: args.id ? { id: args.id } : { slug: args.slug! },
      });
    },

    articles: async (_: any, args: any) => {
      const { filter = {}, sort, limit = 10, offset = 0 } = args;

      const where: any = {};

      // Build filter conditions
      if (filter.categoryId) where.categoryId = filter.categoryId;
      if (filter.author) where.author = filter.author;
      if (filter.source) where.source = filter.source;
      if (filter.searchTerm) {
        where.OR = [
          { title: { contains: filter.searchTerm, mode: 'insensitive' } },
          { content: { contains: filter.searchTerm, mode: 'insensitive' } },
        ];
      }
      if (filter.publishedAfter) {
        where.publishedAt = { ...where.publishedAt, gte: new Date(filter.publishedAfter) };
      }
      if (filter.publishedBefore) {
        where.publishedAt = { ...where.publishedAt, lte: new Date(filter.publishedBefore) };
      }
      if (filter.minWordCount) {
        where.wordCount = { ...where.wordCount, gte: filter.minWordCount };
      }
      if (filter.maxWordCount) {
        where.wordCount = { ...where.wordCount, lte: filter.maxWordCount };
      }
      if (filter.sentiment) {
        where.sentiment = { gte: filter.sentiment.min, lte: filter.sentiment.max };
      }
      if (filter.tags?.length) {
        where.tags = { some: { name: { in: filter.tags } } };
      }

      // Build sort
      let orderByField = 'publishedAt'; // default
      if (sort) {
        // Map GraphQL enum values to Prisma field names
        const fieldMapping: { [key: string]: string } = {
          'PUBLISHED_AT': 'publishedAt',
          'VIEW_COUNT': 'viewCount',
          'WORD_COUNT': 'wordCount',
          'SENTIMENT': 'sentiment',
          'READING_TIME': 'readingTime',
        };
        orderByField = fieldMapping[sort.field] || 'publishedAt';
      }

      const orderBy = sort
        ? {
            [orderByField]: sort.order.toLowerCase() as 'asc' | 'desc',
          }
        : { publishedAt: 'desc' as const };

      return prisma.article.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
      });
    },

    searchArticles: async (_: any, args: { query: string; filter?: any; limit?: number }) => {
      const { query, filter = {}, limit = 10 } = args;

      // Full-text search with facets
      const where = {
        OR: [
          { title: { contains: query, mode: 'insensitive' as const } },
          { content: { contains: query, mode: 'insensitive' as const } },
          { excerpt: { contains: query, mode: 'insensitive' as const } },
        ],
        ...filter,
      };

      const [articles, totalCount, categories, authors, sources] = await Promise.all([
        prisma.article.findMany({ where, take: limit }),
        prisma.article.count({ where }),

        // Facets
        prisma.article.groupBy({
          by: ['categoryId'],
          where,
          _count: true,
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),
        prisma.article.groupBy({
          by: ['author'],
          where,
          _count: true,
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),
        prisma.article.groupBy({
          by: ['source'],
          where,
          _count: true,
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),
      ]);

      // Load category details for facets
      const categoryDetails = await prisma.category.findMany({
        where: { id: { in: categories.map((c) => c.categoryId) } },
      });

      return {
        articles,
        totalCount,
        facets: {
          categories: categories.map((c) => ({
            key: categoryDetails.find((cd) => cd.id === c.categoryId)?.name || 'Unknown',
            count: c._count,
          })),
          authors: authors.map((a) => ({
            key: a.author,
            count: a._count,
          })),
          sources: sources
            .filter((s) => s.source)
            .map((s) => ({
              key: s.source!,
              count: s._count,
            })),
        },
      };
    },

    articleStats: async (_: any, args: { filter?: any }) => {
      const where = args.filter || {};

      const [totalCount, aggregations, _sentimentData, topAuthorsData, categoryData] =
        await Promise.all([
          prisma.article.count({ where }),
          prisma.article.aggregate({
            where,
            _avg: { wordCount: true, readingTime: true },
          }),
          prisma.article.aggregate({
            where,
            _count: { sentiment: true },
            _sum: { sentiment: true },
          }),
          prisma.article.groupBy({
            by: ['author'],
            where,
            _count: true,
            _avg: { sentiment: true },
            _sum: { viewCount: true },
            orderBy: { _count: { id: 'desc' } },
            take: 5,
          }),
          prisma.article.groupBy({
            by: ['categoryId'],
            where,
            _count: true,
          }),
        ]);

      // Calculate sentiment distribution
      const articles = await prisma.article.findMany({
        where,
        select: { sentiment: true },
      });

      const sentimentDistribution = {
        positive: articles.filter((a) => a.sentiment && a.sentiment > 0.3).length,
        neutral: articles.filter((a) => a.sentiment && a.sentiment >= -0.3 && a.sentiment <= 0.3)
          .length,
        negative: articles.filter((a) => a.sentiment && a.sentiment < -0.3).length,
        average: articles.length > 0 
          ? articles.reduce((sum, a) => sum + (a.sentiment || 0), 0) / articles.length 
          : 0,
      };

      // Get category details
      const categories = await prisma.category.findMany({
        where: { id: { in: categoryData.map((c) => c.categoryId) } },
      });

      return {
        totalCount,
        averageWordCount: aggregations._avg.wordCount || 0,
        averageReadingTime: aggregations._avg.readingTime || 0,
        topAuthors: topAuthorsData.map((a) => ({
          author: a.author,
          articleCount: a._count,
          averageSentiment: a._avg.sentiment || 0,
          totalViews: a._sum.viewCount || 0,
        })),
        categoryBreakdown: categoryData.map((c) => ({
          category: categories.find((cat) => cat.id === c.categoryId),
          count: c._count,
          percentage: totalCount > 0 ? (c._count / totalCount) * 100 : 0,
        })),
        sentimentDistribution,
      };
    },

    trendingArticles: async (_: any, args: { limit?: number }) => {
      // Trending based on recent views and engagement
      const since = new Date();
      since.setDate(since.getDate() - 7); // Last 7 days

      return prisma.article.findMany({
        where: { publishedAt: { gte: since } },
        orderBy: { viewCount: 'desc' },
        take: args.limit || 5,
      });
    },

    recommendedArticles: async (_: any, args: { articleId: string; limit?: number }) => {
      const article = await prisma.article.findUnique({
        where: { id: args.articleId },
        include: { tags: true },
      });

      if (!article) throw new GraphQLError('Article not found');

      // Find similar articles based on category and tags
      return prisma.article.findMany({
        where: {
          id: { not: article.id },
          OR: [
            { categoryId: article.categoryId },
            { tags: { some: { id: { in: article.tags.map((t) => t.id) } } } },
          ],
        },
        orderBy: { viewCount: 'desc' },
        take: args.limit || 5,
      });
    },

    categories: () => prisma.category.findMany(),

    category: (_: any, args: { slug: string }) => {
      return prisma.category.findUnique({ where: { slug: args.slug } });
    },

    tags: (_: any, args: { limit?: number }) => {
      return prisma.tag.findMany({ take: args.limit || 50 });
    },

    naturalLanguageQuery: async (_: any, args: { query: string }, context: any) => {
      return context.mcp.nlQueryService.processQuery(args.query);
    },
  },

  Mutation: {
    incrementViewCount: async (_: any, args: { articleId: string }) => {
      return prisma.article.update({
        where: { id: args.articleId },
        data: { viewCount: { increment: 1 } },
      });
    },

    createArticle: async (_: any, args: { input: any }) => {
      const { tagNames = [], ...articleData } = args.input;

      // Calculate derived fields
      const wordCount = articleData.content.split(/\s+/).length;
      const readingTime = Math.ceil(wordCount / 200); // 200 words per minute

      // Create or connect tags
      const tags = {
        connectOrCreate: tagNames.map((name: string) => ({
          where: { name },
          create: { name },
        })),
      };

      return prisma.article.create({
        data: {
          ...articleData,
          slug: articleData.title.toLowerCase().replace(/\s+/g, '-'),
          wordCount,
          readingTime,
          tags,
          publishedAt: new Date(articleData.publishedAt),
        },
      });
    },

    updateArticle: async (_: any, args: { id: string; input: any }) => {
      const { tagNames, ...updateData } = args.input;

      if (updateData.content) {
        updateData.wordCount = updateData.content.split(/\s+/).length;
        updateData.readingTime = Math.ceil(updateData.wordCount / 200);
      }

      return prisma.article.update({
        where: { id: args.id },
        data: updateData,
      });
    },

    deleteArticle: async (_: any, args: { id: string }) => {
      await prisma.article.delete({ where: { id: args.id } });
      return true;
    },
  },

  Article: {
    category: (parent: any, _: any, context: any) => {
      return context.categoryLoader.load(parent.categoryId);
    },

    tags: (parent: any, _: any, context: any) => {
      return context.tagsLoader.load(parent.id);
    },

    engagementScore: (parent: any) => {
      return calculateEngagementScore(parent);
    },

    contentQuality: (parent: any) => {
      return analyzeContentQuality(parent);
    },

    relatedArticles: async (parent: any, args: { limit?: number }) => {
      const article = await prisma.article.findUnique({
        where: { id: parent.id },
        include: { tags: true },
      });

      if (!article) return [];

      return prisma.article.findMany({
        where: {
          id: { not: parent.id },
          OR: [
            { categoryId: parent.categoryId },
            { tags: { some: { id: { in: article.tags.map((t) => t.id) } } } },
          ],
        },
        take: args.limit || 3,
      });
    },
  },

  Category: {
    articles: (parent: any, args: { limit?: number; offset?: number }) => {
      return prisma.article.findMany({
        where: { categoryId: parent.id },
        take: args.limit,
        skip: args.offset,
      });
    },

    articleCount: (parent: any) => {
      return prisma.article.count({ where: { categoryId: parent.id } });
    },
  },

  Tag: {
    articles: (parent: any, args: { limit?: number }) => {
      return prisma.article.findMany({
        where: { tags: { some: { id: parent.id } } },
        take: args.limit,
      });
    },

    articleCount: (parent: any) => {
      return prisma.article.count({
        where: { tags: { some: { id: parent.id } } },
      });
    },
  },
};
