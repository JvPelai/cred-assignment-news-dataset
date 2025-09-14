// src/services/nlQueryService.ts
import OpenAI from 'openai';
import { z } from 'zod';
import { graphql } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { readFileSync } from 'fs';
import { join } from 'path';

// Schema for structured output from LLM
const GraphQLQuerySchema = z.object({
  query: z.string(),
  variables: z.record(z.any()).optional().nullable(), // Allow null values
  explanation: z.string(),
});

export class NLQueryService {
  private openai: OpenAI;
  private schema: any;

  constructor(resolvers: any) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Load GraphQL schema
    const typeDefs = readFileSync(join(__dirname, '../graphql/schema.graphql'), 'utf-8');

    this.schema = makeExecutableSchema({
      typeDefs,
      resolvers,
    });
  }

  async processQuery(naturalLanguageQuery: string) {
    const startTime = Date.now();

    try {
      // Step 1: Convert natural language to GraphQL query
      const graphqlQuery = await this.convertToGraphQL(naturalLanguageQuery);

      // Step 2: Execute the GraphQL query
      const results = await this.executeGraphQLQuery(graphqlQuery.query, graphqlQuery.variables);

      // Step 3: Return formatted results
      return {
        query: naturalLanguageQuery,
        interpretation: graphqlQuery.explanation,
        graphqlQuery: graphqlQuery.query,
        results,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      throw new Error(`Failed to process natural language query: ${error.message}`);
    }
  }

  private async convertToGraphQL(nlQuery: string) {
    // Try OpenAI first, fall back to pattern matching if it fails
    try {
      return await this.convertWithOpenAI(nlQuery);
    } catch (error: any) {
      console.warn('OpenAI failed, using pattern matching fallback:', error.message);
      return this.parseWithPatterns(nlQuery);
    }
  }

  private async convertWithOpenAI(nlQuery: string) {
    const systemPrompt = `You are a GraphQL query generator for a news article database.

CRITICAL: Follow the exact field types and structures below.

Available root queries:
- article(id: ID, slug: String): Article
- articles(filter: ArticleFilter, sort: ArticleSort, limit: Int, offset: Int): [Article!]!
- searchArticles(query: String!, filter: ArticleFilter, limit: Int): SearchResult!
- articleStats(filter: ArticleFilter): ArticleStats!
- trendingArticles(limit: Int): [Article!]!
- recommendedArticles(articleId: ID!, limit: Int): [Article!]!
- categories: [Category!]!
- tags(limit: Int): [Tag!]!

EXACT Article fields (copy these exactly):
{
  id
  title
  slug
  content
  excerpt
  author          # STRING! - select directly, NO subfields
  publishedAt     # STRING! - select directly, NO subfields
  source          # STRING - select directly, NO subfields
  wordCount       # INT! - select directly, NO subfields
  readingTime     # INT! - select directly, NO subfields
  sentiment       # FLOAT - select directly, NO subfields
  viewCount       # INT! - select directly, NO subfields
  category {      # OBJECT - requires subfields
    id
    name
    slug
    description
  }
  tags {          # ARRAY of objects - requires subfields
    id
    name
  }
}

SearchResult structure:
{
  articles {      # Array of Article objects
    # Use Article fields from above
  }
  totalCount      # INT! - select directly
  facets {        # OBJECT - requires subfields
    categories { key, count }
    authors { key, count }
    sources { key, count }
  }
}

ArticleStats structure:
{
  totalCount              # INT! - select directly
  averageWordCount        # FLOAT! - select directly
  averageReadingTime      # FLOAT! - select directly
  topAuthors {            # Array of AuthorStats
    author                # STRING! - select directly, NO subfields
    articleCount          # INT! - select directly
    averageSentiment      # FLOAT! - select directly
    totalViews           # INT! - select directly
  }
  categoryBreakdown {     # Array of CategoryStats
    category {            # OBJECT - requires subfields
      id
      name
      slug
      description
    }
    count                 # INT! - select directly
    percentage            # FLOAT! - select directly
  }
  sentimentDistribution { # OBJECT - requires subfields
    positive              # INT! - select directly
    neutral               # INT! - select directly
    negative              # INT! - select directly
    average               # FLOAT! - select directly
  }
}

Sort format: { field: PUBLISHED_AT|VIEW_COUNT|WORD_COUNT|SENTIMENT|READING_TIME, order: ASC|DESC }

CRITICAL FILTER SYNTAX:
ArticleFilter expects these exact types:
- categoryId: "string-id"           # Single category ID as string
- author: "author-name"             # Author name as string  
- source: "source-name"             # Source name as string
- tags: ["tag1", "tag2"]            # Array of tag NAMES as strings
- publishedAfter: "2025-01-01"      # Date as string
- publishedBefore: "2025-12-31"     # Date as string
- minWordCount: 100                 # Number
- maxWordCount: 500                 # Number
- sentiment: { min: 0.5, max: 1.0 } # Object with min/max numbers
- searchTerm: "search-text"         # String for text search

FILTER EXAMPLES:
✅ CORRECT:
filter: { tags: ["technology", "AI"] }
filter: { author: "Jane Doe" }
filter: { categoryId: "tech-category-id" }

❌ WRONG:
filter: { tags: {name: "technology"} }    # ERROR: tags expects array of strings
filter: { author: {name: "Jane Doe"} }    # ERROR: author expects string
filter: { category: {name: "Tech"} }      # ERROR: use categoryId with string

EXAMPLES:
✅ CORRECT:
query GetArticles {
  articles(limit: 5) {
    id
    title
    author
    category {
      name
    }
  }
}

❌ WRONG:
query GetArticles {
  articles(limit: 5) {
    id
    title
    author {     # ERROR: author is String!, not object
      name
    }
  }
}

Always follow the exact field structures above.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Convert this request to a GraphQL query: "${nlQuery}"
          
Return as JSON with:
- query: The GraphQL query string (follow exact schema above)
- variables: Any variables needed (optional)
- explanation: Brief explanation of what the query does

CRITICAL: In filters, use only simple string/number values, NEVER objects like {name: "value"}. 
Examples: tags: ["AI"], author: "Jane Doe", NOT tags: {name: "AI"} or author: {name: "Jane Doe"}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    const parsed = GraphQLQuerySchema.parse(result);

    // Ensure variables is an object or undefined, not null
    return {
      ...parsed,
      variables: parsed.variables || undefined,
    };
  }

  private parseWithPatterns(nlQuery: string): {
    query: string;
    variables?: any;
    explanation: string;
  } {
    const query = nlQuery.toLowerCase();

    // Pattern: trending articles
    if (query.includes('trending') || query.includes('popular')) {
      return {
        query: `
          query GetTrendingArticles {
            trendingArticles {
              id
              title
              slug
              excerpt
              author
              publishedAt
              viewCount
              category {
                name
              }
            }
          }
        `,
        explanation: 'Fetching trending articles based on view count',
      };
    }

    // Pattern: statistics
    if (query.includes('stats') || query.includes('statistics') || query.includes('analytics')) {
      return {
        query: `
          query GetArticleStats {
            articleStats {
              totalCount
              averageWordCount
              averageReadingTime
              topAuthors {
                author
                articleCount
                averageSentiment
              }
              categoryBreakdown {
                category {
                  name
                }
                count
                percentage
              }
              sentimentDistribution {
                positive
                neutral
                negative
                average
              }
            }
          }
        `,
        explanation: 'Getting comprehensive statistics about articles',
      };
    }

    // Pattern: search for specific terms
    const searchTerms = query.match(/(?:about|on|regarding)\s+(\w+)/);
    if (searchTerms || query.includes('find') || query.includes('search')) {
      const searchTerm = searchTerms
        ? searchTerms[1]
        : query
            .split(' ')
            .find(
              (word) =>
                !['find', 'search', 'articles', 'about', 'on', 'the', 'a', 'an'].includes(word)
            ) || 'news';

      return {
        query: `
          query SearchArticles($searchQuery: String!) {
            searchArticles(query: $searchQuery, limit: 10) {
              articles {
                id
                title
                slug
                excerpt
                author
                publishedAt
                viewCount
                category {
                  name
                }
                tags {
                  name
                }
              }
              totalCount
            }
          }
        `,
        variables: { searchQuery: searchTerm },
        explanation: `Searching for articles containing "${searchTerm}"`,
      };
    }

    // Pattern: recent articles
    if (query.includes('recent') || query.includes('latest') || query.includes('new')) {
      return {
        query: `
          query GetRecentArticles {
            articles(sort: { field: PUBLISHED_AT, order: DESC }, limit: 10) {
              id
              title
              slug
              excerpt
              author
              publishedAt
              viewCount
              category {
                name
              }
            }
          }
        `,
        explanation: 'Fetching the most recently published articles',
      };
    }

    // Pattern: categories
    if (query.includes('categories') || query.includes('category')) {
      return {
        query: `
          query GetCategories {
            categories {
              id
              name
              slug
              description
              articleCount
            }
          }
        `,
        explanation: 'Listing all available article categories',
      };
    }

    // Default: return recent articles
    return {
      query: `
        query GetDefaultArticles {
          articles(limit: 10) {
            id
            title
            slug
            excerpt
            author
            publishedAt
            viewCount
            category {
              name
            }
          }
        }
      `,
      explanation: 'Fetching a general list of articles (default query)',
    };
  }

  public async executeGraphQLQuery(query: string, variables?: any, contextValue?: any) {
    // Import DataLoader and prisma for context
    const DataLoader = require('dataloader');
    const { prisma } = require('../lib/prisma');

    // Create DataLoaders for context (same as in context.ts)
    const createCategoryLoader = () =>
      new DataLoader(async (ids: readonly string[]) => {
        const categories = await prisma.category.findMany({
          where: { id: { in: [...ids] } },
        });
        return ids.map((id: string) => categories.find((cat: any) => cat.id === id));
      });

    const createTagsLoader = () =>
      new DataLoader(async (articleIds: readonly string[]) => {
        const articles = await prisma.article.findMany({
          where: { id: { in: [...articleIds] } },
          include: { tags: true },
        });
        return articleIds.map((id: string) => articles.find((a: any) => a.id === id)?.tags || []);
      });

    // Create proper context
    const defaultContext = {
      prisma,
      categoryLoader: createCategoryLoader(),
      tagsLoader: createTagsLoader(),
    };

    const result = await graphql({
      schema: this.schema,
      source: query,
      variableValues: variables,
      contextValue: contextValue || defaultContext,
    });

    if (result.errors) {
      throw new Error(`GraphQL execution error: ${result.errors[0].message}`);
    }

    return result.data;
  }

  // MCP Tool Definition
  getMCPToolDefinition() {
    return {
      name: 'query_news_articles',
      description: 'Search and analyze news articles using natural language queries',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language query about news articles',
          },
        },
        required: ['query'],
      },
      handler: async (params: { query: string }) => {
        return this.processQuery(params.query);
      },
    };
  }
}

// Example MCP Server Implementation
export class MCPServer {
  public nlQueryService: NLQueryService;

  constructor(resolvers: any) {
    this.nlQueryService = new NLQueryService(resolvers);
  }

  getTools() {
    return [
      this.nlQueryService.getMCPToolDefinition(),
      {
        name: 'get_article_stats',
        description: 'Get statistical analysis of articles',
        parameters: {
          type: 'object',
          properties: {
            filter: {
              type: 'object',
              description: 'Optional filters for statistics',
              properties: {
                category: { type: 'string' },
                author: { type: 'string' },
                dateRange: {
                  type: 'object',
                  properties: {
                    start: { type: 'string', format: 'date' },
                    end: { type: 'string', format: 'date' },
                  },
                },
              },
            },
          },
        },
        handler: async (params: any) => {
          const query = `
            query GetStats($filter: ArticleFilter) {
              articleStats(filter: $filter) {
                totalCount
                averageWordCount
                averageReadingTime
                topAuthors {
                  author
                  articleCount
                  averageSentiment
                }
                categoryBreakdown {
                  category {
                    name
                  }
                  count
                  percentage
                }
                sentimentDistribution {
                  positive
                  neutral
                  negative
                  average
                }
              }
            }
          `;

          const variables = params.filter
            ? {
                filter: {
                  ...(params.filter.category && { categoryId: params.filter.category }),
                  ...(params.filter.author && { author: params.filter.author }),
                  ...(params.filter.dateRange && {
                    publishedAfter: params.filter.dateRange.start,
                    publishedBefore: params.filter.dateRange.end,
                  }),
                },
              }
            : {};

          return this.nlQueryService.executeGraphQLQuery(query, variables);
        },
      },
    ];
  }

  async handleToolCall(toolName: string, params: any) {
    const tool = this.getTools().find((t) => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }
    return tool.handler(params);
  }
}
