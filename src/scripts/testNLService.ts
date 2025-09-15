import { NLQueryService } from '../services/nlQueryService';
import { resolvers } from '../graphql/resolvers';

async function testNLQueries() {
  const nlService = new NLQueryService(resolvers);

  const testQueries = [
    "Show me trending articles",
    "Find articles about technology",
    "Get recent news",
    "Show me statistics",
    "List all categories",
    "What are the popular tags?"
  ];

  console.log('Testing NL Query Service...\n');

  for (const query of testQueries) {
    try {
      console.log(`\n🔍 Query: "${query}"`);
      console.log('─'.repeat(50));
      
      const result = await nlService['convertToGraphQL'](query);
      console.log(`✅ Interpretation: ${result.explanation}`);
      console.log(`📝 Generated GraphQL:`);
      console.log(result.query);
      
      if (result.variables) {
        console.log(`🔧 Variables:`, JSON.stringify(result.variables, null, 2));
      }

      // Validate the query
      const validation = nlService['validateQuery'](result.query);
      if (validation.isValid) {
        console.log(`✅ Validation: PASSED`);
      } else {
        console.log(`❌ Validation: FAILED`);
        console.log(`   Errors: ${validation.errors.join(', ')}`);
      }
      
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

testNLQueries().catch(console.error);
