import { prisma } from '../lib/prisma';

async function main() {
  const tech = await prisma.category.upsert({
    where: { slug: 'technology' },
    create: { name: 'Technology', slug: 'technology', description: 'Tech news and articles' },
    update: {},
  });

  const tagAI = await prisma.tag.upsert({
    where: { name: 'AI' },
    create: { name: 'AI' },
    update: {},
  });
  const tagCloud = await prisma.tag.upsert({
    where: { name: 'Cloud' },
    create: { name: 'Cloud' },
    update: {},
  });

  const now = new Date();

  const a1 = await prisma.article.upsert({
    where: { slug: 'intro-to-ai' },
    create: {
      title: 'Intro to AI',
      slug: 'intro-to-ai',
      content: 'Artificial Intelligence overview...'.repeat(20),
      excerpt: 'A quick intro to AI',
      author: 'Alice',
      categoryId: tech.id,
      publishedAt: now,
      source: 'Example News',
      wordCount: 500,
      readingTime: 3,
      sentiment: 0.2,
      viewCount: 10,
      tags: { connect: [{ id: tagAI.id }] },
    },
    update: {},
  });

  const a2 = await prisma.article.upsert({
    where: { slug: 'cloud-trends-2025' },
    create: {
      title: 'Cloud Trends 2025',
      slug: 'cloud-trends-2025',
      content: 'Cloud computing trends...'.repeat(30),
      excerpt: 'Where cloud is going next',
      author: 'Bob',
      categoryId: tech.id,
      publishedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      source: 'Tech Daily',
      wordCount: 800,
      readingTime: 5,
      sentiment: 0.4,
      viewCount: 25,
      tags: { connect: [{ id: tagCloud.id }, { id: tagAI.id }] },
    },
    update: {},
  });

  console.log('Seeded:', { tech, a1: a1.slug, a2: a2.slug });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
