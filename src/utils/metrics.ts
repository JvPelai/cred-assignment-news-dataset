// src/utils/metrics.ts

interface Article {
  viewCount: number;
  wordCount: number;
  readingTime: number;
  sentiment?: number | null;
  publishedAt: Date;
  content: string;
  title: string;
}

/**
 * Calculate engagement score based on various metrics
 * Score ranges from 0 to 100
 */
export function calculateEngagementScore(article: Article): number {
  const now = new Date();
  const ageInDays = Math.max(
    1,
    (now.getTime() - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Factors for engagement
  const viewsPerDay = article.viewCount / ageInDays;
  const normalizedViews = Math.min(100, viewsPerDay * 10); // Cap at 100

  const readingTimeScore = Math.min(100, (article.readingTime / 5) * 100); // 5 min is optimal
  const wordCountScore = Math.min(100, (article.wordCount / 800) * 100); // 800 words is optimal

  // Weight the factors
  const score =
    normalizedViews * 0.5 + // Views are most important
    readingTimeScore * 0.2 +
    wordCountScore * 0.2 +
    (article.sentiment ? Math.abs(article.sentiment) * 10 : 5); // Emotional content engages more

  return Math.round(Math.min(100, score));
}

/**
 * Analyze content quality based on various metrics
 */
export function analyzeContentQuality(article: Article) {
  const scores = {
    length: 0,
    readability: 0,
    structure: 0,
  };

  // Length score
  if (article.wordCount < 300) {
    scores.length = 40; // Too short
  } else if (article.wordCount > 2000) {
    scores.length = 60; // Too long
  } else {
    scores.length = 80 + (article.wordCount / 1000) * 10; // Optimal range
  }

  // Readability score (simplified)
  const avgSentenceLength = article.content.split(/[.!?]/).filter((s) => s.trim()).length;
  const wordsPerSentence = article.wordCount / Math.max(1, avgSentenceLength);

  if (wordsPerSentence < 10) {
    scores.readability = 60; // Too choppy
  } else if (wordsPerSentence > 25) {
    scores.readability = 50; // Too complex
  } else {
    scores.readability = 90; // Good readability
  }

  // Structure score (check for paragraphs)
  const paragraphs = article.content.split(/\n\n/).filter((p) => p.trim()).length;
  const wordsPerParagraph = article.wordCount / Math.max(1, paragraphs);

  if (wordsPerParagraph > 200) {
    scores.structure = 50; // Paragraphs too long
  } else if (wordsPerParagraph < 50) {
    scores.structure = 60; // Too fragmented
  } else {
    scores.structure = 85; // Good structure
  }

  const overallScore = (scores.length + scores.readability + scores.structure) / 3;

  return {
    score: Math.round(overallScore),
    readability: getReadabilityLevel(scores.readability),
    completeness: getCompletenessLevel(article.wordCount),
  };
}

function getReadabilityLevel(score: number): string {
  if (score >= 80) return 'EXCELLENT';
  if (score >= 65) return 'GOOD';
  if (score >= 50) return 'AVERAGE';
  return 'NEEDS_IMPROVEMENT';
}

function getCompletenessLevel(wordCount: number): string {
  if (wordCount < 300) return 'BRIEF';
  if (wordCount < 600) return 'CONCISE';
  if (wordCount < 1200) return 'COMPREHENSIVE';
  return 'DETAILED';
}

/**
 * Calculate basic sentiment from text (placeholder - use real NLP in production)
 */
export function calculateSentiment(text: string): number {
  // This is a simplified sentiment calculation
  // In production, use a proper NLP library or API

  const positiveWords = [
    'good',
    'great',
    'excellent',
    'amazing',
    'wonderful',
    'positive',
    'success',
    'win',
    'happy',
  ];
  const negativeWords = [
    'bad',
    'terrible',
    'awful',
    'negative',
    'fail',
    'loss',
    'sad',
    'angry',
    'poor',
  ];

  const words = text.toLowerCase().split(/\s+/);
  let score = 0;

  words.forEach((word) => {
    if (positiveWords.includes(word)) score += 1;
    if (negativeWords.includes(word)) score -= 1;
  });

  // Normalize to -1 to 1 range
  return Math.max(-1, Math.min(1, (score / Math.max(1, words.length)) * 10));
}
