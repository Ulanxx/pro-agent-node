/**
 * 博查搜索集成测试
 *
 * 此测试用于验证实际的博查 API 调用是否正常工作
 *
 * 使用方法：
 * 1. 确保在 .env 文件中设置了有效的 BOCHA_API_KEY
 * 2. 运行: npm test -- web-search.tool.integration.spec.ts
 *
 * 注意：此测试会调用真实的博查 API，需要有效的 API key
 *
 * API 文档: https://api.bocha.cn/v1/web-search
 */

import { WebSearchTool } from './web-search.tool';

import 'dotenv/config';

describe('WebSearchTool Integration Tests', () => {
  let service: WebSearchTool;

  beforeAll(() => {
    service = new WebSearchTool();
  });

  it('should perform real search with valid API key', async () => {
    // 检查是否有 API key
    if (!process.env.BOCHA_API_KEY) {
      console.warn('⚠️  BOCHA_API_KEY not found, skipping integration test');
      return;
    }

    console.log('🔍 Testing real Bocha API search...');

    const query = '人工智能最新发展';
    const results = await service.search(query);
    console.log(`✅ Found ${results.length} results for query: "${query}"`);

    // 验证结果
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);

    if (results.length > 0) {
      console.log('\n📋 Search Results:');
      results.forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.title}`);
        console.log(`   URL: ${result.url}`);
        console.log(`   Snippet: ${result.snippet.substring(0, 100)}...`);
      });

      // 验证每个结果的结构
      results.forEach((result) => {
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('snippet');
        expect(typeof result.title).toBe('string');
        expect(typeof result.url).toBe('string');
        expect(typeof result.snippet).toBe('string');
        expect(result.title.length).toBeGreaterThan(0);
        expect(result.url.length).toBeGreaterThan(0);
        expect(result.snippet.length).toBeGreaterThan(0);
      });
    } else {
      console.warn('⚠️  No results returned from Bocha API');
    }
  }, 30000); // 30秒超时

  it('should handle different query types', async () => {
    if (!process.env.BOCHA_API_KEY) {
      console.warn('⚠️  BOCHA_API_KEY not found, skipping test');
      return;
    }

    const queries = [
      'NestJS best practices',
      'TypeScript performance tips',
      'AI agent architecture',
    ];

    for (const query of queries) {
      console.log(`\n🔍 Searching for: "${query}"`);
      const results = await service.search(query);
      console.log(`✅ Found ${results.length} results`);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    }
  }, 60000); // 60秒超时
});
