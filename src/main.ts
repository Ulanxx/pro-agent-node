/**
 * 应用程序入口文件
 *
 * 该文件是 Pro-Agent 项目的启动入口，负责创建和启动 NestJS 应用程序实例。
 *
 * 主要功能：
 * - 创建 NestJS 应用实例
 * - 启用 CORS（跨域资源共享）以支持前端访问
 * - 监听指定端口（默认 3000）以接收 HTTP 请求
 *
 * 环境变量：
 * - PORT: 应用程序监听的端口号，默认为 3000
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * 启动应用程序
 *
 * 该函数负责初始化并启动 NestJS 应用程序。
 * 它会创建应用实例、配置 CORS，并开始监听指定端口。
 */
async function bootstrap() {
  // 创建 NestJS 应用实例
  const app = await NestFactory.create(AppModule);

  // 启用 CORS 以支持跨域请求（前端访问）
  app.enableCors();

  // 监听指定端口，默认为 3000
  await app.listen(process.env.PORT ?? 3000);
}

// 启动应用程序
bootstrap();
