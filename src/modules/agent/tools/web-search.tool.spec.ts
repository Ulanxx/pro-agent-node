import { Test, TestingModule } from '@nestjs/testing';
import { WebSearchTool } from './web-search.tool';

describe('WebSearchTool', () => {
  let service: WebSearchTool;

  afterEach(() => {
    jest.restoreAllMocks();
    // 清除环境变量
    delete process.env.BOCHA_API_KEY;
  });

  describe('search', () => {
    it('should return simulated results when API key is not provided', async () => {
      // 确保没有 API key
      delete process.env.BOCHA_API_KEY;

      const module: TestingModule = await Test.createTestingModule({
        providers: [WebSearchTool],
      }).compile();

      service = module.get<WebSearchTool>(WebSearchTool);

      const query = 'test query';
      const results = await service.search(query);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('title');
      expect(results[0]).toHaveProperty('url');
      expect(results[0]).toHaveProperty('snippet');

      // 验证模拟结果包含查询词
      expect(results[0].title).toContain(query);
    });

    it('should call Bocha API when API key is provided', async () => {
      // 在创建 service 之前设置 API key
      process.env.BOCHA_API_KEY = 'test-api-key';

      const module: TestingModule = await Test.createTestingModule({
        providers: [WebSearchTool],
      }).compile();

      service = module.get<WebSearchTool>(WebSearchTool);

      const mockResponse = {
        code: 200,
        log_id: 'test-log-id',
        msg: null,
        data: {
          _type: 'SearchResponse',
          queryContext: {
            originalQuery: 'test query',
          },
          webPages: {
            webSearchUrl: 'https://bochaai.com/search?q=test',
            totalEstimatedMatches: 1000000,
            value: [
              {
                id: 'https://api.bochaai.com/v1/#WebPages.0',
                name: 'Test Result',
                url: 'https://example.com',
                displayUrl: 'https://example.com',
                snippet: 'Test snippet',
                summary: 'Test content snippet',
                siteName: 'Example',
                datePublished: '2025-01-01T00:00:00+08:00',
                dateLastCrawled: '2025-01-01T00:00:00Z',
              },
            ],
          },
        },
      };

      const mockFetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve(mockResponse),
      });

      global.fetch = mockFetch;

      const query = 'test query';
      const results = await service.search(query);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.bocha.cn/v1/web-search',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            freshness: 'noLimit',
            summary: true,
            count: 8,
          }),
        },
      );

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Test Result');
      expect(results[0].url).toBe('https://example.com');
      expect(results[0].snippet).toBe('Test content snippet');
    });

    it('should return simulated results when API call fails', async () => {
      // 在创建 service 之前设置 API key
      process.env.BOCHA_API_KEY = 'test-api-key';

      const module: TestingModule = await Test.createTestingModule({
        providers: [WebSearchTool],
      }).compile();

      service = module.get<WebSearchTool>(WebSearchTool);

      const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      const query = 'test query';
      const results = await service.search(query);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      // 应该返回模拟数据而不是空数组
      expect(results[0].title).toContain(query);
    });

    it('should handle empty API response gracefully', async () => {
      // 在创建 service 之前设置 API key
      process.env.BOCHA_API_KEY = 'test-api-key';

      const module: TestingModule = await Test.createTestingModule({
        providers: [WebSearchTool],
      }).compile();

      service = module.get<WebSearchTool>(WebSearchTool);

      const mockResponse = {
        code: 200,
        log_id: 'test-log-id',
        msg: null,
        data: {
          _type: 'SearchResponse',
          queryContext: {
            originalQuery: 'test query',
          },
          webPages: {
            webSearchUrl: 'https://bochaai.com/search?q=test',
            totalEstimatedMatches: 0,
            value: [],
          },
        },
      };

      const mockFetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve(mockResponse),
      });
      global.fetch = mockFetch;

      const query = 'test query';
      const results = await service.search(query);

      // 当 API 返回空结果时，应该返回空数组
      expect(results).toEqual([]);
    });

    it('should handle malformed API response gracefully', async () => {
      // 在创建 service 之前设置 API key
      process.env.BOCHA_API_KEY = 'test-api-key';

      const module: TestingModule = await Test.createTestingModule({
        providers: [WebSearchTool],
      }).compile();

      service = module.get<WebSearchTool>(WebSearchTool);

      const mockResponse = {
        code: 200,
        log_id: 'test-log-id',
        msg: null,
        data: null,
      };

      const mockFetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve(mockResponse),
      });
      global.fetch = mockFetch;

      const query = 'test query';
      const results = await service.search(query);

      // 当 API 返回格式错误的数据时，应该返回空数组
      expect(results).toEqual([]);
    });

    it('should return correct number of results from API', async () => {
      // 在创建 service 之前设置 API key
      process.env.BOCHA_API_KEY = 'test-api-key';

      const module: TestingModule = await Test.createTestingModule({
        providers: [WebSearchTool],
      }).compile();

      service = module.get<WebSearchTool>(WebSearchTool);

      const mockResponse = {
        code: 200,
        log_id: 'test-log-id',
        msg: null,
        data: {
          _type: 'SearchResponse',
          queryContext: {
            originalQuery: 'test query',
          },
          webPages: {
            webSearchUrl: 'https://bochaai.com/search?q=test',
            totalEstimatedMatches: 1000000,
            value: [
              {
                id: 'https://api.bochaai.com/v1/#WebPages.0',
                name: 'Result 1',
                url: 'https://example.com/1',
                displayUrl: 'https://example.com/1',
                snippet: 'Snippet 1',
                summary: 'Content 1',
                siteName: 'Example',
                datePublished: '2025-01-01T00:00:00+08:00',
                dateLastCrawled: '2025-01-01T00:00:00Z',
              },
              {
                id: 'https://api.bochaai.com/v1/#WebPages.1',
                name: 'Result 2',
                url: 'https://example.com/2',
                displayUrl: 'https://example.com/2',
                snippet: 'Snippet 2',
                summary: 'Content 2',
                siteName: 'Example',
                datePublished: '2025-01-01T00:00:00+08:00',
                dateLastCrawled: '2025-01-01T00:00:00Z',
              },
              {
                id: 'https://api.bochaai.com/v1/#WebPages.2',
                name: 'Result 3',
                url: 'https://example.com/3',
                displayUrl: 'https://example.com/3',
                snippet: 'Snippet 3',
                summary: 'Content 3',
                siteName: 'Example',
                datePublished: '2025-01-01T00:00:00+08:00',
                dateLastCrawled: '2025-01-01T00:00:00Z',
              },
            ],
          },
        },
      };

      const mockFetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve(mockResponse),
      });
      global.fetch = mockFetch;

      const query = 'test query';
      const results = await service.search(query);

      expect(results).toHaveLength(3);
      expect(results[0].title).toBe('Result 1');
      expect(results[1].title).toBe('Result 2');
      expect(results[2].title).toBe('Result 3');
    });

    it('should map API response fields correctly', async () => {
      // 在创建 service 之前设置 API key
      process.env.BOCHA_API_KEY = 'test-api-key';

      const module: TestingModule = await Test.createTestingModule({
        providers: [WebSearchTool],
      }).compile();

      service = module.get<WebSearchTool>(WebSearchTool);

      const mockResponse = {
        code: 200,
        log_id: 'test-log-id',
        msg: null,
        data: {
          _type: 'SearchResponse',
          queryContext: {
            originalQuery: 'test query',
          },
          webPages: {
            webSearchUrl: 'https://bochaai.com/search?q=test',
            totalEstimatedMatches: 1000000,
            value: [
              {
                id: 'https://api.bochaai.com/v1/#WebPages.0',
                name: 'API Title',
                url: 'https://api.example.com',
                displayUrl: 'https://api.example.com',
                snippet: 'API Snippet',
                summary: 'API Content',
                siteName: 'Example',
                datePublished: '2025-01-01T00:00:00+08:00',
                dateLastCrawled: '2025-01-01T00:00:00Z',
              },
            ],
          },
        },
      };

      const mockFetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve(mockResponse),
      });
      global.fetch = mockFetch;

      const query = 'test query';
      const results = await service.search(query);

      expect(results[0]).toEqual({
        title: 'API Title',
        url: 'https://api.example.com',
        snippet: 'API Content',
      });
    });
  });
});
