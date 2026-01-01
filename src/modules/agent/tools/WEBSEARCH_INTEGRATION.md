# WebSearch 集成指南

## 概述

WebSearch 工具已经完全集成到系统中,可以在多个流程中使用。本文档说明如何在各个流程中添加搜索功能。

## 当前集成状态

### 已完成的集成

1. ✅ **WebSearchTool** - 搜索工具已实现并测试通过
2. ✅ **AgentService.performSearch()** - 搜索方法已暴露
3. ✅ **TaskExecutorService.executeWebSearchTask()** - 搜索任务执行器已实现
4. ✅ **TaskType.SEARCH_WEB** - 搜索任务类型已定义
5. ✅ **Artifact 集成** - 搜索结果会保存为 artifact 并通过 socket 发送到前端

## 可使用搜索的流程

### 1. 自主规划流程 (Autonomous Planning)

这是最推荐的方式,搜索可以作为任务的一部分自动执行。

#### 在 Planner 中添加搜索任务

在 [`src/modules/agent/planner/planner.service.ts`](../planner/planner.service.ts) 中,可以在任务规划时添加搜索任务:

```typescript
// 在 planTasks 方法中
async planTasks(sessionId: string, topic: string, context: PlanningContext): Promise<TaskList> {
  // ... 现有代码 ...

  // 添加搜索任务
  const searchTask: Task = {
    id: `task_search_${Date.now()}`,
    type: TaskType.SEARCH_WEB,
    description: `搜索 "${topic}" 相关的最新信息`,
    status: TaskStatus.PENDING,
    parameters: {
      query: topic,
    },
    dependencies: [], // 可以设置为依赖其他任务
    priority: 1,
    metadata: {
      createdAt: Date.now(),
      reason: '需要搜索最新信息以生成更好的内容',
    },
  };

  tasks.push(searchTask);

  return {
    id: `tasklist_${Date.now()}`,
    sessionId,
    topic,
    status: 'planning',
    tasks,
    createdAt: Date.now(),
  };
}
```

#### 在 Reflector 中动态添加搜索任务

在 [`src/modules/agent/reflector/reflector.service.ts`](../reflector/reflector.service.ts) 中,可以根据执行结果动态添加搜索任务:

```typescript
async reflect(taskList: TaskList, currentTask: Task, context: ReflectionContext): Promise<ReflectionResult> {
  // ... 现有代码 ...

  // 如果发现内容需要更多信息,添加搜索任务
  const needsMoreInfo = /* 判断是否需要更多信息 */;

  if (needsMoreInfo) {
    return {
      needsNewTasks: true,
      shouldContinue: true,
      reason: '需要搜索更多信息',
      newTaskSuggestions: [
        {
          type: TaskType.SEARCH_WEB,
          description: '搜索相关技术文档',
          parameters: {
            query: /* 根据上下文生成查询词 */,
          },
          priority: 2,
          dependencies: [
            {
              taskId: currentTask.id,
              condition: 'success',
            },
          ],
        },
      ],
    };
  }

  // ... 现有代码 ...
}
```

### 2. 5 阶段流程 (5-Stage PPT Generation)

可以在 5 阶段流程的任何阶段中添加搜索功能。

#### 在需求分析阶段添加搜索

在 [`src/modules/agent/chat-5-stage.service.ts`](../chat-5-stage.service.ts) 中,可以在分析主题前先搜索相关信息:

```typescript
async handle5StagePPTGeneration(
  sessionId: string,
  topic: string,
  chatMessageId: string,
  targetStage?: TargetStage,
) {
  // 在分析前先搜索
  const searchResults = await this.agentService.performSearch(
    topic,
    (artifactId, type, content) => {
      this.socketGateway.emitToolArtifact(sessionId, {
        messageId: chatMessageId,
        showInCanvas: true,
        artifact: {
          id: artifactId,
          type,
          content,
          version: 'v1',
          timestamp: Date.now(),
        },
      });
    },
  );

  // 将搜索结果作为上下文传递给分析阶段
  const analysis = await this.agentService.analyzeTopic(
    topic,
    (status, progress, message) => {
      this.socketGateway.emitProgress(sessionId, {
        status,
        progress,
        message,
      });
    },
  );

  // ... 继续后续流程 ...
}
```

#### 在特定阶段添加搜索

可以在任何阶段添加搜索,例如在生成课程配置前搜索相关案例:

```typescript
async generateCourseConfigWithSearch(topic: string, sessionId: string) {
  // 搜索相关案例和最佳实践
  const searchQuery = `${topic} 最佳实践 案例`;
  const searchResults = await this.agentService.performSearch(searchQuery);

  // 将搜索结果整合到提示中
  const searchContext = searchResults
    .map(r => `- ${r.title}: ${r.snippet}`)
    .join('\n');

  const analysis = await this.agentService.analyzeTopic(topic);
  
  // 在生成课程配置时传入搜索结果
  const courseConfig = await this.agentService.generateCourseConfig(
    topic,
    `${analysis}\n\n参考信息:\n${searchContext}`,
    (status, progress, message) => {
      this.socketGateway.emitProgress(sessionId, {
        status,
        progress,
        message,
      });
    },
  );

  return courseConfig;
}
```

### 3. 用户主动触发搜索

用户可以通过特定关键词触发搜索功能。

#### 在 ChatService 中添加搜索触发

在 [`src/modules/agent/chat.service.ts`](../chat.service.ts) 中,可以检测用户的搜索意图:

```typescript
async handleMessage(sessionId: string, message: string, metaData: JobStartMetaDataPayload) {
  // 检测搜索意图
  const isSearchRequest = 
    message.includes('搜索') || 
    message.includes('查找') ||
    message.includes('search');

  if (isSearchRequest) {
    // 提取搜索关键词
    const query = message
      .replace(/搜索|查找|search/gi, '')
      .trim();

    const results = await this.agentService.performSearch(
      query,
      (artifactId, type, content) => {
        this.socketGateway.emitToolArtifact(sessionId, {
          messageId: `msg_${uuidv4()}`,
          showInCanvas: true,
          artifact: {
            id: artifactId,
            type,
            content,
            version: 'v1',
            timestamp: Date.now(),
          },
        });
      },
    );

    // 返回搜索结果给用户
    const searchSummary = results
      .map(r => `• ${r.title}\n  ${r.url}`)
      .join('\n\n');

    this.socketGateway.emitMessageChunk(sessionId, {
      id: `msg_${uuidv4()}`,
      chunk: `为您找到 ${results.length} 条搜索结果:\n\n${searchSummary}`,
    });

    return;
  }

  // ... 现有逻辑 ...
}
```

## 搜索结果的使用

### 搜索结果的数据结构

```typescript
interface SearchResult {
  title: string;      // 搜索结果标题
  url: string;        // 结果链接
  snippet: string;    // 内容摘要
}
```

### 在 LLM 提示中使用搜索结果

```typescript
const searchResults = await this.agentService.performSearch(topic);

// 将搜索结果格式化为 LLM 可以理解的格式
const searchContext = searchResults.map(result => {
  return `
标题: ${result.title}
链接: ${result.url}
摘要: ${result.snippet}
`;
}).join('\n---\n');

// 在提示中使用
const prompt = `
请根据以下搜索结果生成内容:

${searchContext}

任务: ${taskDescription}
`;
```

### 搜索结果作为 Artifact

搜索结果会自动保存为 artifact,类型为 `search_result` 或 `web_page`:

```typescript
{
  id: 'art_search_1234567890',
  type: 'search_result',
  content: {
    query: '搜索关键词',
    results: [
      {
        title: '结果标题',
        url: 'https://example.com',
        snippet: '内容摘要'
      }
    ]
  },
  version: 'v1',
  timestamp: 1234567890
}
```

## 推荐的使用场景

### 场景 1: 生成技术主题 PPT 前搜索最新信息

```typescript
// 在 Planner 中
const searchTask: Task = {
  type: TaskType.SEARCH_WEB,
  description: `搜索 ${topic} 的最新发展和趋势`,
  parameters: { query: `${topic} 最新发展 2025` },
  dependencies: [],
  priority: 1, // 最高优先级,先执行
};
```

### 场景 2: 生成案例研究 PPT

```typescript
// 在 Planner 中
const searchTask: Task = {
  type: TaskType.SEARCH_WEB,
  description: `搜索 ${topic} 的成功案例`,
  parameters: { query: `${topic} 成功案例 实践` },
  dependencies: [],
  priority: 1,
};

// 依赖搜索结果的分析任务
const analyzeTask: Task = {
  type: TaskType.ANALYZE_TOPIC,
  description: '分析搜索到的案例',
  dependencies: [
    { taskId: searchTask.id, condition: 'success' }
  ],
  priority: 2,
};
```

### 场景 3: 内容优化时搜索参考资料

```typescript
// 在 Reflector 中
if (reflection.qualityScore < 0.7) {
  return {
    needsNewTasks: true,
    shouldContinue: true,
    reason: '内容质量不足,需要搜索参考资料',
    newTaskSuggestions: [
      {
        type: TaskType.SEARCH_WEB,
        description: `搜索 ${currentTask.description} 的参考资料`,
        parameters: {
          query: `${context.topic} 参考资料 最佳实践`,
        },
        dependencies: [
          { taskId: currentTask.id, condition: 'success' }
        ],
        priority: 3,
      },
    ],
  };
}
```

## 注意事项

1. **API Key 配置**
   - 确保 `.env` 文件中设置了 `BOCHA_API_KEY`
   - 如果没有 API key,系统会返回模拟数据

2. **搜索频率控制**
   - 避免短时间内执行大量搜索
   - 可以在任务中添加延迟或限流逻辑

3. **搜索结果验证**
   - 搜索结果可能不相关,需要在 LLM 提示中说明要筛选相关内容
   - 可以添加验证逻辑,过滤低质量结果

4. **错误处理**
   - 搜索可能失败,需要优雅降级
   - 当前实现:搜索失败时返回模拟数据

5. **性能考虑**
   - 搜索是网络操作,会增加整体执行时间
   - 建议将搜索任务设置为高优先级,尽早执行

## 测试搜索功能

### 运行集成测试

```bash
npm test -- web-search.tool.integration.spec.ts
```

### 手动测试

在应用中发送包含搜索意图的消息,例如:
- "帮我搜索人工智能的最新发展"
- "查找 Python 编程的最佳实践"
- "搜索关于市场营销策略的案例"

## 总结

WebSearch 功能已经完全集成到系统中,可以在以下流程中使用:

1. ✅ **自主规划流程** - 通过任务类型 `SEARCH_WEB`
2. ✅ **5 阶段流程** - 在任何阶段调用 `agentService.performSearch()`
3. ✅ **用户主动触发** - 检测搜索意图并执行搜索

搜索结果会:
- 自动保存为 artifact
- 通过 socket 实时发送到前端
- 可以作为上下文传递给 LLM

建议在以下场景使用搜索:
- 生成技术主题 PPT 前搜索最新信息
- 生成案例研究 PPT 时搜索实际案例
- 内容质量不足时搜索参考资料
- 用户明确要求搜索时
