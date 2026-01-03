import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

@Injectable()
export class UrlParsingService {
  private readonly logger = new Logger(UrlParsingService.name);

  /**
   * 解析网页 URL
   */
  async parseUrl(url: string): Promise<{
    url: string;
    title: string;
    content: string;
    parsedAt: Date;
  }> {
    this.logger.log(`Parsing URL: ${url}`);

    try {
      // 发起 HTTP 请求
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      // 解析 HTML
      const $ = cheerio.load(response.data);

      // 提取标题
      const title =
        $('title').text() ||
        $('meta[property="og:title"]').attr('content') ||
        'Untitled';

      // 提取正文（移除 script、style 等标签）
      $('script, style, nav, footer, header').remove();
      const content = $('body')
        .text()
        .trim()
        .replace(/\s+/g, ' ')
        .substring(0, 10000); // 限制长度

      this.logger.log(`URL parsed successfully: ${url}`);

      return {
        url,
        title,
        content,
        parsedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to parse URL: ${error.message}`);

      if (error.response) {
        throw new BadRequestException(
          `Failed to fetch URL: HTTP ${error.response.status}`,
        );
      }

      throw new BadRequestException(`Failed to parse URL: ${error.message}`);
    }
  }
}
