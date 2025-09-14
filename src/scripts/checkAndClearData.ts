import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAndClearData() {
  try {
    // Count existing articles
    const articleCount = await prisma.article.count();
    console.log(`📊 Current article count: ${articleCount}`);

    if (articleCount > 0) {
      console.log('🧹 Clearing existing data...');

      // Clear all data in the correct order (respecting foreign key constraints)
      await prisma.article.deleteMany();
      await prisma.category.deleteMany();
      await prisma.tag.deleteMany();

      console.log('✅ Data cleared successfully');
    } else {
      console.log('✅ Database is already empty');
    }

    console.log('📊 Final article count:', await prisma.article.count());
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndClearData();
