# News Dataset API

A comprehensive backend service for news articles featuring GraphQL API, natural language queries, and Model Context Protocol (MCP) tools integration. Built with TypeScript, PostgreSQL, and OpenAI.

## Features

- 📰 **News Article Management**: Complete CRUD operations for articles, categories, and tags
- 🔍 **GraphQL API**: Rich query interface with relationships and computed fields
- 🤖 **Natural Language Queries**: Convert natural language to GraphQL using OpenAI
- 🛠️ **MCP Tools**: Model Context Protocol integration for AI assistants
- 📊 **Analytics**: Article statistics, sentiment analysis, and engagement metrics
- 🐳 **Dockerized**: Easy deployment with Docker Compose

## Tech Stack

- **Backend**: Node.js, TypeScript, Express
- **Database**: PostgreSQL with Prisma ORM
- **API**: GraphQL (Apollo Server)
- **AI**: OpenAI GPT for natural language processing
- **Infrastructure**: Docker, Docker Compose

## Quick Start

### Prerequisites

- Docker and Docker Compose
- OpenAI API key
- Node.js 22.19+ (for local development)


### 1. Environment Configuration

Create a `.env` file in the root directory:

```env
DATABASE_URL=postgresql://newsuser:newspass@localhost:5432/newsdb
OPENAI_API_KEY=your_openai_api_key_here
NODE_ENV=development
PORT=4000
```

### 2. Start with Docker Compose

```bash
# Start all services
docker-compose up -d

```

### 3. Initialize Database

```bash
# Run database migrations
docker-compose exec app npm run migrate

# Seed with sample data
docker-compose exec app npm run seed
```

The API will be available at:

- **GraphQL Playground**: http://localhost:4000/graphql
- **Health Check**: http://localhost:4000/health
- **MCP Tools**: http://localhost:4000/mcp/tools

## Development

### Local Setup

```bash
# Install dependencies
npm install

# Start PostgreSQL (if not using Docker)
docker-compose up -d postgres

# Run migrations
npx prisma migrate dev

# Seed database
npm run seed

# Start development server
npm run dev
```

### Available Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm start            # Start production server
npm run seed         # Populate database with sample data
npm run migrate      # Run database migrations
```

## API Examples

### GraphQL Queries

#### 1. Get All Articles with Categories

```graphql
query GetArticles {
  articles(limit: 10) {
    id
    title
    excerpt
    author
    publishedAt
    category {
      name
    }
    tags {
      name
    }
    engagementScore
    viewCount
  }
}
```

#### 2. Search Articles by Category

```graphql
query SearchByCategory {
  articlesByCategory(categorySlug: "technology", limit: 5) {
    title
    author
    publishedAt
    excerpt
    readingTime
    sentiment
  }
}
```

#### 3. Get Article Statistics

```graphql
query GetStats {
  articleStats {
    totalCount
    averageWordCount
    averageReadingTime
  }

  categories {
    name
    articleCount
  }
}
```

#### 4. Full Article with Related Content

```graphql
query GetArticleDetail($slug: String!) {
  articleBySlug(slug: $slug) {
    id
    title
    content
    author
    publishedAt
    category {
      name
      description
    }
    tags {
      name
    }
    contentQuality {
      score
      readability
      completeness
    }
    relatedArticles(limit: 3) {
      title
      excerpt
      author
    }
  }
}
```

Variables:

```json
{
  "slug": "your-article-slug"
}
```

### Natural Language Queries

Send POST requests to `/graphql` with natural language descriptions:

#### Example 1: Simple Article Search

```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { naturalLanguageQuery(query: \"Show me recent technology articles\") { query interpretation graphqlQuery results executionTime } }"
  }'
```

#### Example 2: Complex Analytics Query

```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { naturalLanguageQuery(query: \"What are the most popular categories and their average sentiment?\") { query interpretation graphqlQuery results executionTime } }"
  }'
```

#### Example 3: Author-based Search

```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { naturalLanguageQuery(query: \"Find articles by John Smith about climate change\") { query interpretation graphqlQuery results executionTime } }"
  }'
```

### MCP Tools Integration

The service provides MCP (Model Context Protocol) tools for AI assistants.

#### List Available Tools

```bash
curl http://localhost:4000/mcp/tools
```

#### Execute Query Tool

```bash
curl -X POST http://localhost:4000/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "query_news_articles",
    "input": {
      "query": "technology trends in 2024"
    }
  }'
```

#### Search Articles Tool

```bash
curl -X POST http://localhost:4000/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "search_articles",
    "input": {
      "category": "technology",
      "limit": 5
    }
  }'
```

#### Get Article Statistics Tool

```bash
curl -X POST http://localhost:4000/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "get_article_stats",
    "input": {}
  }'
```

## Testing Scripts

### Test Natural Language Service

```bash
# Run the NL service test script
npm run dev -- src/scripts/testNLService.ts

# Or with Docker
docker-compose exec app tsx src/scripts/testNLService.ts
```

### Import Kaggle Dataset

```bash
# Import news data from Kaggle dataset
npm run dev -- src/scripts/importKaggleNews.ts

# Or with Docker
docker-compose exec app tsx src/scripts/importKaggleNews.ts
```

### Check and Clear Data

```bash
# Check database status and optionally clear data
npm run dev -- src/scripts/checkAndClearData.ts

# Or with Docker
docker-compose exec app tsx src/scripts/checkAndClearData.ts
```

## Advanced Examples

### Complex GraphQL Queries

#### Trending Articles with Full Analytics

```graphql
query TrendingAnalytics {
  trendingArticles(limit: 10) {
    title
    author
    category {
      name
    }
    engagementScore
    viewCount
    sentiment
    contentQuality {
      score
      readability
    }
    tags {
      name
      articleCount
    }
  }

  articleStats {
    totalCount
    averageWordCount
    topCategories: categories {
      name
      articleCount
    }
  }
}
```

#### Author Performance Analysis

```graphql
query AuthorAnalysis($author: String!) {
  articlesByAuthor(author: $author) {
    title
    publishedAt
    category {
      name
    }
    viewCount
    sentiment
    engagementScore
    readingTime
  }
}
```

### Natural Language Query Examples

Try these natural language queries through the GraphQL interface:

1. **"Show me the most engaging articles from last week"**
2. **"What categories have the highest average sentiment?"**
3. **"Find long-form articles about climate change"**
4. **"Which authors write the most about technology?"**
5. **"Show me short articles with high engagement scores"**
6. **"What are the trending tags this month?"**

## Project Structure

```
├── docker-compose.yml          # Docker services configuration
├── Dockerfile                  # Application container
├── package.json               # Node.js dependencies and scripts
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
├── src/
│   ├── index.ts              # Application entry point
│   ├── context.ts            # GraphQL context
│   ├── graphql/
│   │   ├── schema.graphql    # GraphQL type definitions
│   │   └── resolvers.ts      # GraphQL resolvers
│   ├── routes/
│   │   ├── health.ts         # Health check endpoint
│   │   ├── index.ts          # Route definitions
│   │   └── mcp.ts            # MCP tools endpoints
│   ├── services/
│   │   └── nlQueryService.ts # Natural language processing
│   ├── scripts/
│   │   ├── seed.ts           # Database seeding
│   │   ├── testNLService.ts  # NL service testing
│   │   └── importKaggleNews.ts # Data import
│   └── utils/
│       └── metrics.ts        # Analytics utilities
```

## Configuration

### Environment Variables

| Variable         | Description                      | Default     |
| ---------------- | -------------------------------- | ----------- |
| `DATABASE_URL`   | PostgreSQL connection string     | Required    |
| `OPENAI_API_KEY` | OpenAI API key for NL processing | Required    |
| `PORT`           | Server port                      | 4000        |
| `NODE_ENV`       | Environment mode                 | development |

### Database Schema

The project uses the following main entities:

- **Articles**: News articles with content, metadata, and analytics
- **Categories**: Article categorization (Technology, Politics, Sports, etc.)
- **Tags**: Flexible tagging system for articles

## Troubleshooting

### Common Issues

1. **Database Connection Issues**

   ```bash
   # Check if PostgreSQL is running
   docker-compose ps postgres

   # View database logs
   docker-compose logs postgres
   ```

2. **OpenAI API Issues**

   ```bash
   # Verify API key is set
   echo $OPENAI_API_KEY

   # Test NL service
   tsx src/scripts/testNLService.ts
   ```

3. **Build Issues**

   ```bash
   # Clear Docker cache
   docker-compose down -v
   docker system prune -a

   # Rebuild
   docker-compose build --no-cache
   ```

### Logs

```bash
# View application logs
docker-compose logs app

# Follow logs in real-time
docker-compose logs -f app

# View all service logs
docker-compose logs
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.
