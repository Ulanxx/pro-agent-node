/**
 * 应用程序根模块
 *
 * 该模块是 Pro-Agent 项目的根模块，负责导入和配置所有子模块。
 *
 * 主要配置：
 * - ConfigModule: 全局配置管理
 * - TypeOrmModule: MySQL 数据库连接
 * - BullModule: Redis 队列管理（用于 PPT 生成任务）
 * - ServeStaticModule: 静态文件服务（前端资源）
 *
 * 子模块：
 * - AgentModule: AI 代理模块，负责 PPT 生成的核心逻辑
 * - RenderModule: 渲染模块，负责 PPT 文件的渲染
 * - SocketModule: WebSocket 模块，负责实时通信
 * - StorageModule: 存储模块，负责文件存储（Bunny CDN + Redis 缓存）
 * - DatabaseModule: 数据库模块，负责数据持久化
 * - ApplicationModule: 应用模块，负责应用级别的业务逻辑
 *
 * 环境变量：
 * - MYSQL_HOST: MySQL 主机地址，默认 localhost
 * - MYSQL_PORT: MySQL 端口，默认 3306
 * - MYSQL_USERNAME: MySQL 用户名，默认 root
 * - MYSQL_PASSWORD: MySQL 密码，默认空
 * - MYSQL_DATABASE: MySQL 数据库名，默认 pro_agent
 * - MYSQL_SYNCHRONIZE: 是否自动同步数据库结构，默认 false
 * - REDIS_HOST: Redis 主机地址，默认 localhost
 * - REDIS_PORT: Redis 端口，默认 6379
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentModule } from './modules/agent/agent.module';
import { RenderModule } from './modules/render/render.module';
import { SocketModule } from './modules/socket/socket.module';
import { StorageModule } from './modules/storage/storage.module';
import { DatabaseModule } from './modules/database/database.module';
import { ApplicationModule } from './modules/application/application.module';

@Module({
  imports: [
    // 全局配置模块，使环境变量在整个应用中可用
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // TypeORM 数据库配置（MySQL）
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      username: process.env.MYSQL_USERNAME || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'pro_agent',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.MYSQL_SYNCHRONIZE === 'true', // 生产环境应设为 false
      logging: false,
    }),
    // 静态文件服务（前端资源）
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
    // BullMQ 队列配置（Redis）
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    // 注册 PPT 生成队列
    BullModule.registerQueue({
      name: 'ppt-generation',
    }),
    // 导入业务模块
    AgentModule,
    RenderModule,
    SocketModule,
    StorageModule,
    DatabaseModule,
    ApplicationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
