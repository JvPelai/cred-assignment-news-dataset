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

      // Step 2: Validate the generated query
      const validationResult = this.validateQuery(graphqlQuery.query);
      if (!validationResult.isValid) {
        throw new Error(`Generated query validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Step 3: Execute the GraphQL query
      const results = await this.executeGraphQLQuery(graphqlQuery.query, graphqlQuery.variables);

      // Step 4: Return formatted results
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

  private validateQuery(query: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const queryLower = query.toLowerCase();

    // Define allowed root queries based on actual schema
    const allowedQueries = [
      'article',
      'articles', 
      'searchArticles',
      'articleStats',
      'trendingArticles',
      'recommendedArticles',
      'categories',
      'category',
      'tags'
    ];

    // Check if query uses only allowed root queries
    const usedQueries = allowedQueries.filter(q => queryLower.includes(q.toLowerCase()));
    if (usedQueries.length === 0) {
      errors.push('Query does not use any valid root query field');
    }

    // Validate trendingArticles parameters (limit is optional)
    // No validation needed for trendingArticles since limit is optional

    // Validate searchArticles has required query parameter
    if (queryLower.includes('searcharticles') && !queryLower.includes('query:')) {
      errors.push('searchArticles requires a query parameter');
    }

    // Validate recommendedArticles has required articleId parameter
    if (queryLower.includes('recommendedarticles') && !queryLower.includes('articleid:')) {
      errors.push('recommendedArticles requires an articleId parameter');
    }

    // Check for common field errors
    if (queryLower.includes('author {') || queryLower.includes('author{')) {
      errors.push('author is a String field, not an object - select it directly');
    }

    if (queryLower.includes('publishedat {') || queryLower.includes('publishedat{')) {
      errors.push('publishedAt is a String field, not an object - select it directly');
    }

    // Check for invalid filter syntax
    if (queryLower.includes('category:') && !queryLower.includes('categoryid:')) {
      errors.push('Use categoryId instead of category in filters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
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

CRITICAL: Only use the EXACT queries and fields listed below. Do not create any queries or fields not explicitly listed.

AVAILABLE ROOT QUERIES (use EXACTLY as shown):
1. article(id: ID, slug: String): Article
2. articles(filter: ArticleFilter, sort: ArticleSort, limit: Int = 10, offset: Int = 0): [Article!]!
3. searchArticles(query: String!, filter: ArticleFilter, limit: Int = 10): SearchResult!
4. articleStats(filter: ArticleFilter): ArticleStats!
5. trendingArticles(limit: Int = 5): [Article!]!  # limit parameter is optional
6. recommendedArticles(articleId: ID!, limit: Int = 5): [Article!]!
7. categories: [Category!]!
8. category(slug: String!): Category
9. tags(limit: Int = 50): [Tag!]!

EXACT Article fields (use only these):
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

SearchResult structure (for searchArticles only):
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

ArticleStats structure (for articleStats only):
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

Category fields (for categories/category queries):
{
  id
  name
  slug
  description
  articleCount     # INT! - computed field
}

Tag fields (for tags query):
{
  id
  name
  articleCount     # INT! - computed field
}

STRICT QUERY VALIDATION RULES:
1. ONLY use queries from the list above
2. For trendingArticles: limit parameter is optional (defaults to 5)
3. For categories/tags: limit parameter is optional
4. For articles: all parameters are optional
5. For searchArticles: query parameter is REQUIRED
6. For recommendedArticles: articleId parameter is REQUIRED

Sort format (only for articles query): 
{ field: PUBLISHED_AT|VIEW_COUNT|WORD_COUNT|SENTIMENT|READING_TIME, order: ASC|DESC }

CRITICAL FILTER SYNTAX (only for articles and searchArticles):
ArticleFilter expects these exact types:
- categoryId: "string-id"           # Single category ID as string (use ID type)
- author: "author-name"             # Author name as string  
- source: "source-name"             # Source name as string
- tags: ["tag1", "tag2"]            # Array of tag NAMES as strings
- publishedAfter: "2025-01-01"      # Date as ISO string
- publishedBefore: "2025-12-31"     # Date as ISO string
- minWordCount: 100                 # Number
- maxWordCount: 500                 # Number
- sentiment: { min: 0.5, max: 1.0 } # Object with min/max numbers
- searchTerm: "search-text"         # String for text search

✅ CORRECT queries that EXIST in schema:
query GetTrending {
  trendingArticles(limit: 10) {    # limit parameter is optional
    id
    title
    author
  }
}

query GetArticles {
  articles(limit: 5, filter: { author: "Jane Doe" }) {
    id
    title
    author
    category { name }
  }
}

query SearchNews {
  searchArticles(query: "technology") {
    articles { id, title }
    totalCount
  }
}

❌ WRONG - these will FAIL:
query BadFilter {
  articles(filter: { category: "tech" }) {  # ERROR: use categoryId not category
    id
  }
}

CRITICAL: Only generate queries using the exact field names and structures above. Do not invent new fields or queries.`;

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

    // Post-process to fix common OpenAI mistakes
    let correctedQuery = parsed.query;
    
    // Ensure trendingArticles includes limit parameter if not specified
    if (correctedQuery.includes('trendingArticles') && !correctedQuery.includes('trendingArticles(')) {
      correctedQuery = correctedQuery.replace('trendingArticles', 'trendingArticles(limit: 10)');
    }
    
    // Ensure categories includes articleCount field
    if (correctedQuery.includes('categories') && !correctedQuery.includes('articleCount')) {
      correctedQuery = correctedQuery.replace(
        /categories\s*\{\s*([^}]+)\s*\}/g, 
        'categories { $1 articleCount }'
      );
    }

    // Ensure tags includes articleCount field  
    if (correctedQuery.includes('tags') && !correctedQuery.includes('articleCount')) {
      correctedQuery = correctedQuery.replace(
        /tags[^{]*\{\s*([^}]+)\s*\}/g,
        'tags { $1 articleCount }'
      );
    }

    // Ensure variables is an object or undefined, not null
    return {
      ...parsed,
      query: correctedQuery,
      variables: parsed.variables || undefined,
    };
  }

  private parseWithPatterns(nlQuery: string): {
    query: string;
    variables?: any;
    explanation: string;
  } {
    const query = nlQuery.toLowerCase();

    // Pattern: trending articles (with optional limit)
    if (query.includes('trending') || query.includes('popular')) {
      return {
        query: `
          query GetTrendingArticles {
            trendingArticles(limit: 10) {
              id
              title
              slug
              excerpt
              author
              publishedAt
              viewCount
              category {
                id
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
                totalViews
              }
              categoryBreakdown {
                category {
                  id
                  name
                  slug
                  description
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
                  id
                  name
                }
                tags {
                  id
                  name
                }
              }
              totalCount
              facets {
                categories {
                  key
                  count
                }
                authors {
                  key
                  count
                }
                sources {
                  key
                  count
                }
              }
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
                id
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

    // Pattern: tags
    if (query.includes('tags') || query.includes('tag')) {
      return {
        query: `
          query GetTags {
            tags(limit: 20) {
              id
              name
              articleCount
            }
          }
        `,
        explanation: 'Listing popular article tags',
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
              id
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
                  totalViews
                }
                categoryBreakdown {
                  category {
                    id
                    name
                    slug
                    description
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

          const variables = params?.filter
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
