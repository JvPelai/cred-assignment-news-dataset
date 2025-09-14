// src/scripts/seed.ts
import { PrismaClient } from '@prisma/client';
import { calculateSentiment } from '../utils/metrics';

const prisma = new PrismaClient();

// Sample news data generator
function generateArticle(index: number, category: any) {
  const authors = ['John Smith', 'Jane Doe', 'Mike Johnson', 'Sarah Williams', 'David Brown'];
  const sources = ['Reuters', 'BBC News', 'CNN', 'The Guardian', 'TechCrunch'];

  const titles = [
    'Breaking: Major Technology Breakthrough Announced',
    'Climate Change: New Study Reveals Shocking Data',
    'Global Markets React to Economic Policy Changes',
    'Innovation in Healthcare: AI Revolutionizes Diagnosis',
    'Sports: Historic Victory in Championship Finals',
  ];

  const content = `This is a comprehensive article about ${titles[index % titles.length]}.
  
  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
  
  The implications of this development are far-reaching. Experts in the field have expressed both excitement and caution about the potential impacts. Dr. Example Expert stated, "This represents a significant shift in our understanding of the subject matter."
  
  Further analysis reveals several key points that deserve attention. First, the immediate effects will be felt across multiple sectors. Second, long-term consequences may reshape entire industries. Third, regulatory frameworks will need to adapt to these new realities.
  
  In conclusion, this development marks a pivotal moment in the ongoing evolution of our modern world. Stakeholders across all levels will need to carefully consider their responses to these changes.`;

  const wordCount = content.split(/\s+/).length;
  const readingTime = Math.ceil(wordCount / 200);
  const sentiment = calculateSentiment(content);

  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * 90)); // Random date in last 90 days

  return {
    title: `${titles[index % titles.length]} - Part ${index + 1}`,
    slug: `article-${category.slug}-${index + 1}`,
    content,
    excerpt: content.substring(0, 150) + '...',
    author: authors[Math.floor(Math.random() * authors.length)],
    categoryId: category.id,
    source: sources[Math.floor(Math.random() * sources.length)],
    wordCount,
    readingTime,
    sentiment,
    viewCount: Math.floor(Math.random() * 10000),
    publishedAt: date,
  };
}

async function seed() {
  console.log('Starting database seed...');

  try {
    // Clear existing data
    await prisma.article.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.category.deleteMany();

    console.log('Cleared existing data');

    // Create categories
    const categories = await Promise.all([
      prisma.category.create({
        data: {
          name: 'Technology',
          slug: 'technology',
          description: 'Latest tech news and innovations',
        },
      }),
      prisma.category.create({
        data: {
          name: 'Politics',
          slug: 'politics',
          description: 'Political news and analysis',
        },
      }),
      prisma.category.create({
        data: {
          name: 'Business',
          slug: 'business',
          description: 'Business and economic news',
        },
      }),
      prisma.category.create({
        data: {
          name: 'Science',
          slug: 'science',
          description: 'Scientific discoveries and research',
        },
      }),
      prisma.category.create({
        data: {
          name: 'Sports',
          slug: 'sports',
          description: 'Sports news and updates',
        },
      }),
      prisma.category.create({
        data: {
          name: 'Health',
          slug: 'health',
          description: 'Health and wellness news',
        },
      }),
    ]);

    console.log(`Created ${categories.length} categories`);

    // Create tags
    const tagNames = [
      'Breaking News',
      'Feature',
      'Analysis',
      'Opinion',
      'Investigation',
      'AI',
      'Climate',
      'Economy',
      'Innovation',
      'Research',
      'COVID-19',
      'Elections',
      'Technology',
      'Startups',
      'Markets',
    ];

    const tags = await Promise.all(tagNames.map((name) => prisma.tag.create({ data: { name } })));

    console.log(`Created ${tags.length} tags`);

    // Create articles
    const articlesData = [];
    let articleIndex = 0;

    for (const category of categories) {
      // Create 20 articles per category
      for (let i = 0; i < 20; i++) {
        articlesData.push(generateArticle(articleIndex++, category));
      }
    }

    // Create articles with random tags
    for (const articleData of articlesData) {
      // Select 2-4 random tags
      const numTags = Math.floor(Math.random() * 3) + 2;
      const selectedTags = tags.sort(() => Math.random() - 0.5).slice(0, numTags);

      await prisma.article.create({
        data: {
          ...articleData,
          tags: {
            connect: selectedTags.map((tag) => ({ id: tag.id })),
          },
        },
      });
    }

    console.log(`Created ${articlesData.length} articles`);

    // Print statistics
    const stats = await prisma.article.aggregate({
      _count: true,
      _avg: {
        wordCount: true,
        readingTime: true,
        sentiment: true,
        viewCount: true,
      },
    });

    console.log('\nDatabase Statistics:');
    console.log(`   Total Articles: ${stats._count}`);
    console.log(`   Avg Word Count: ${Math.round(stats._avg.wordCount || 0)}`);
    console.log(`   Avg Reading Time: ${Math.round(stats._avg.readingTime || 0)} minutes`);
    console.log(`   Avg Sentiment: ${(stats._avg.sentiment || 0).toFixed(2)}`);
    console.log(`   Avg View Count: ${Math.round(stats._avg.viewCount || 0)}`);

    console.log('\nDatabase seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
