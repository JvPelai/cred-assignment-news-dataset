import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

interface HuffPostArticle {
  category: string;
  headline: string;
  authors: string;
  link: string;
  short_description: string;
  date: string;
}

async function importKaggleNews() {
  console.log('Starting HuffPost news import...');

  const categories = await setupCategories();

  await setupTags();

  let count = 0;
  const batchSize = 100;
  let batch: any[] = [];

  try {
    const jsonData = fs.readFileSync('src/scripts/News_Category_Dataset_v3.json', 'utf-8');
    const articles: HuffPostArticle[] = jsonData
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    console.log(`📊 Found ${articles.length} articles to process`);

    for (const article of articles) {
      try {
        const content = article.short_description || 'No content available';
        const wordCount = content.split(' ').length;
        const publishedDate = article.date ? new Date(article.date) : new Date();

        const articleData = {
          title: article.headline || `Untitled Article ${count}`,
          slug: generateSlug(article.headline || `article-${count}`) + `-${count}`,
          content: content,
          excerpt: generateExcerpt(content),
          author: article.authors || 'Unknown Author',
          publishedAt: publishedDate.toISOString(),
          source: 'HuffPost',
          wordCount,
          readingTime: Math.ceil(wordCount / 200),
          sentiment: (Math.random() - 0.5) * 2,
          viewCount: Math.floor(Math.random() * 10000),
          categoryId: getCategoryForHuffPost(article.category, categories),
        };

        batch.push(articleData);
        count++;

        // Process batch when it reaches batchSize
        if (batch.length >= batchSize) {
          await processBatch(batch);
          batch = [];
          console.log(`📈 Processed ${count} articles...`);
        }
      } catch (error) {
        console.error(`Error processing article ${count}:`, error);
      }
    }

    // Process remaining articles in batch
    if (batch.length > 0) {
      await processBatch(batch);
    }

    console.log(`Import complete! Total articles processed: ${count}`);
    await prisma.$disconnect();
    return count;
  } catch (error) {
    console.error('Error reading JSON file:', error);
    throw error;
  }
}

async function processBatch(batch: any[]) {
  try {
    const articles = await prisma.article.createMany({
      data: batch,
      skipDuplicates: true,
    });

    console.log(`✅ Successfully created ${articles.count} articles in this batch`);
  } catch (error: any) {
    if (error.code === 'P2002') {
      console.log(`⚠️  Some articles in batch skipped due to duplicate constraints`);
    } else {
      console.error('Error creating batch of articles:', error);
    }
  }
}

async function setupCategories() {
  const categoryData = [
    { name: 'Politics', slug: 'politics', description: 'Political news and analysis' },
    { name: 'Technology', slug: 'technology', description: 'Technology and innovation' },
    { name: 'Business', slug: 'business', description: 'Business and finance news' },
    { name: 'Sports', slug: 'sports', description: 'Sports news and updates' },
    { name: 'Entertainment', slug: 'entertainment', description: 'Entertainment and lifestyle' },
    { name: 'Health', slug: 'health', description: 'Health and wellness' },
    { name: 'Science', slug: 'science', description: 'Science and research' },
    { name: 'World', slug: 'world', description: 'International news' },
    { name: 'Travel', slug: 'travel', description: 'Travel and tourism' },
    { name: 'Food', slug: 'food', description: 'Food and dining' },
    { name: 'Style', slug: 'style', description: 'Fashion and lifestyle' },
    { name: 'Crime', slug: 'crime', description: 'Crime and legal news' },
    { name: 'Comedy', slug: 'comedy', description: 'Comedy and humor' },
    { name: 'Parenting', slug: 'parenting', description: 'Parenting and family' },
    { name: 'Education', slug: 'education', description: 'Education and learning' },
  ];

  const categories = [];
  for (const cat of categoryData) {
    const category = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
    categories.push(category);
  }
  return categories;
}

async function setupTags() {
  const tagNames = [
    'Breaking News',
    'Analysis',
    'Opinion',
    'Investigation',
    'Interview',
    'Elections',
    'Economy',
    'Climate Change',
    'AI',
    'Cryptocurrency',
    'COVID-19',
    'Research',
    'Innovation',
    'Startup',
    'Healthcare',
    'Education',
    'Environment',
    'International',
    'Local',
    'Trending',
  ];

  const tags = [];
  for (const name of tagNames) {
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    tags.push(tag);
  }
  return tags;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80)
    .replace(/^-|-$/g, '');
}

function generateExcerpt(content: string): string {
  if (!content) return 'No excerpt available';
  return content.length > 200 ? content.substring(0, 200) + '...' : content;
}

function getCategoryForHuffPost(huffpostCategory: string, categories: any[]): string {
  const categoryMap: Record<string, string> = {
    POLITICS: 'politics',
    WELLNESS: 'health',
    ENTERTAINMENT: 'entertainment',
    TRAVEL: 'travel',
    'STYLE & BEAUTY': 'style',
    PARENTING: 'parenting',
    'HEALTHY LIVING': 'health',
    'QUEER VOICES': 'entertainment',
    'FOOD & DRINK': 'food',
    BUSINESS: 'business',
    COMEDY: 'comedy',
    SPORTS: 'sports',
    'BLACK VOICES': 'politics',
    'HOME & LIVING': 'style',
    PARENTS: 'parenting',
    'THE WORLDPOST': 'world',
    WEDDINGS: 'style',
    WOMEN: 'politics',
    IMPACT: 'world',
    DIVORCE: 'parenting',
    CRIME: 'crime',
    MEDIA: 'entertainment',
    'WEIRD NEWS': 'entertainment',
    GREEN: 'science',
    WORLDPOST: 'world',
    RELIGION: 'world',
    STYLE: 'style',
    SCIENCE: 'science',
    'WORLD NEWS': 'world',
    TASTE: 'food',
    TECH: 'technology',
    MONEY: 'business',
    ARTS: 'entertainment',
    FIFTY: 'style',
    'GOOD NEWS': 'world',
    'ARTS & CULTURE': 'entertainment',
    ENVIRONMENT: 'science',
    COLLEGE: 'education',
    'LATINO VOICES': 'politics',
    'CULTURE & ARTS': 'entertainment',
    EDUCATION: 'education',
  };

  const normalizedCategory = huffpostCategory.toUpperCase();
  const categorySlug = categoryMap[normalizedCategory] || 'world';
  const category = categories.find((c) => c.slug === categorySlug);
  return category ? category.id : categories[0].id;
}

importKaggleNews()
  .then((count) => {
    console.log(`🎉 Successfully imported ${count} articles from HuffPost dataset!`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  });
