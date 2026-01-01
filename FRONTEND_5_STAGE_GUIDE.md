# 5 阶段 PPT 生成流程 - 前端对接文档

## 概述

本文档描述了新的 5 阶段 PPT 生成流程的前端对接方式。该流程将 PPT 生成分为 6 个明确的步骤，每个步骤都有独立的工具消息和 Artifact 产物。

## 启用方式

在后端 `.env` 文件中设置：
```bash
USE_5_STAGE_FLOW=true
```

## 流程概览

```
用户输入 "什么是 Agent"
   ↓
1️⃣ 需求分析 (analyze_topic)
   → requirement_analysis Artifact
   ↓
2️⃣ 课程配置生成 (generate_course_config)
   → course_config Artifact
   ↓
3️⃣ 视频大纲生成 (generate_video_outline)
   → video_outline Artifact
   ↓
4️⃣ PPT 脚本生成 (generate_slide_scripts)
   → slide_scripts Artifact (数组)
   ↓
5️⃣ 主题风格生成 (generate_presentation_theme)
   → presentation_theme Artifact
   ↓
6️⃣ 逐页生成 PPT (generate_slides)
   → dsl Artifact (最终 PPT 文档)
```

## WebSocket 事件流

### 1. 初始化会话

**客户端发送：**
```typescript
socket.emit('chat:init', {
  sessionId: 'uuid-v4-string'
});
```

### 2. 发送用户消息

**客户端发送：**
```typescript
socket.emit('chat:send', {
  sessionId: 'your-session-id',
  message: '什么是 Agent',
  metaData: {} // 可选
});
```

### 3. 接收消息流

#### 3.1 助手消息开始
```typescript
socket.on('message:start', (data) => {
  // data: {
  //   id: 'msg_xxx',
  //   role: 'assistant',
  //   content: ''
  // }
});
```

#### 3.2 助手消息内容
```typescript
socket.on('message:chunk', (data) => {
  // data: {
  //   id: 'msg_xxx',
  //   chunk: '我将使用 5 阶段流程为您生成专业的教学 PPT...'
  // }
});
```

#### 3.3 工具消息开始（6 个阶段）
```typescript
socket.on('tool:start', (data) => {
  // 阶段 1: 需求分析
  // {
  //   id: 'tool_xxx',
  //   toolName: 'analyze_topic',
  //   title: '需求分析',
  //   status: 'in_progress',
  //   parentMessageId: 'msg_xxx'
  // }
  
  // 阶段 2: 课程配置
  // {
  //   id: 'tool_xxx',
  //   toolName: 'generate_course_config',
  //   title: '课程配置生成',
  //   status: 'in_progress',
  //   parentMessageId: 'msg_xxx'
  // }
  
  // 阶段 3: 视频大纲
  // {
  //   id: 'tool_xxx',
  //   toolName: 'generate_video_outline',
  //   title: '视频大纲生成',
  //   status: 'in_progress',
  //   parentMessageId: 'msg_xxx'
  // }
  
  // 阶段 4: PPT 脚本
  // {
  //   id: 'tool_xxx',
  //   toolName: 'generate_slide_scripts',
  //   title: 'PPT 脚本生成',
  //   status: 'in_progress',
  //   parentMessageId: 'msg_xxx'
  // }
  
  // 阶段 5: 主题风格
  // {
  //   id: 'tool_xxx',
  //   toolName: 'generate_presentation_theme',
  //   title: '主题风格生成',
  //   status: 'in_progress',
  //   parentMessageId: 'msg_xxx'
  // }
  
  // 阶段 6: 逐页生成
  // {
  //   id: 'tool_xxx',
  //   toolName: 'generate_slides',
  //   title: '逐页生成 PPT',
  //   status: 'in_progress',
  //   progressText: '正在逐页生成 PPT...',
  //   parentMessageId: 'msg_xxx'
  // }
});
```

#### 3.4 工具 Artifact 产物
```typescript
socket.on('tool:artifact', (data) => {
  // data: {
  //   messageId: 'tool_xxx',
  //   showInCanvas: true,
  //   artifact: {
  //     id: 'art_xxx',
  //     type: 'requirement_analysis' | 'course_config' | 'video_outline' | 
  //           'slide_scripts' | 'presentation_theme' | 'dsl',
  //     content: { /* 具体内容 */ },
  //     version: 'v1',
  //     timestamp: 1234567890
  //   }
  // }
});
```

#### 3.5 工具消息更新
```typescript
socket.on('tool:update', (data) => {
  // data: {
  //   id: 'tool_xxx',
  //   status: 'completed' | 'failed',
  //   content: '需求分析完成',
  //   artifactIds: ['art_xxx']
  // }
});
```

#### 3.6 进度更新（仅在阶段 6）
```typescript
socket.on('progress', (data) => {
  // data: {
  //   status: 'in_progress',
  //   progress: 50, // 0-100
  //   message: '正在生成第 5/10 页...',
  //   artifactId: 'art_dsl_xxx'
  // }
});
```

#### 3.7 完成事件
```typescript
socket.on('completion', (data) => {
  // data: {
  //   success: true,
  //   finalArtifactId: 'art_dsl_xxx'
  // }
});
```

## Artifact 类型详解

### 1. requirement_analysis（需求分析）
```typescript
interface RequirementAnalysis {
  coreIntent: string;        // 核心意图
  targetAudience: string;    // 目标受众
  keyPoints: string[];       // 关键信息点
  constraints: string[];     // 约束条件
  suggestedStructure: string; // 建议结构
}
```

### 2. course_config（课程配置）
```typescript
interface CourseConfig {
  narrativeStyle: string;    // 叙事风格：学术型、商业型、科普型
  targetAudience: string;    // 目标受众：专业人士、管理层、学生等
  duration: number;          // 预计时长（分钟）
  teachingObjectives: string[]; // 教学目标
  difficultyLevel: string;   // 难度级别：入门、中级、高级
}
```

### 3. video_outline（视频大纲）
```typescript
interface VideoOutline {
  theme: string;             // 主题
  knowledgeUnits: Array<{    // 知识单元
    unitTitle: string;
    knowledgePoints: Array<{
      pointTitle: string;
      description: string;
      estimatedTime: number; // 预计讲解时长（分钟）
    }>;
  }>;
}
```

### 4. slide_scripts（PPT 脚本）
```typescript
interface SlideScript {
  slideNumber: number;       // 幻灯片序号
  contentDesign: string;     // 内容设计
  visualSuggestions: string; // 可视化建议
  narration: string;         // 口播稿
  keyMessage: string;        // 核心信息
}

// Artifact content 是 SlideScript[]
```

### 5. presentation_theme（主题风格）
```typescript
interface PresentationTheme {
  themeName: string;         // 主题名称
  colorScheme: {
    primary: string;         // 主色调（hex）
    secondary: string;       // 辅助色（hex）
    background: string;      // 背景色（hex）
    text: string;           // 文字色（hex）
    accent: string;         // 强调色（hex）
  };
  fontConfig: {
    titleFont: string;       // 标题字体
    bodyFont: string;        // 正文字体
    titleSize: number;       // 标题字号
    bodySize: number;        // 正文字号
  };
  masterSlides: Array<{      // 母版配置
    type: string;            // 类型：title, content, section
    layout: string;          // 布局描述
  }>;
}
```

### 6. dsl（最终 PPT 文档）
```typescript
interface AnyGenDocument {
  title: string;
  meta: {
    theme: string;
    aspectRatio: '16:9' | '4:3';
  };
  pages: Array<{
    id: string;
    meta: {
      title: string;
      speakNotes?: string;
      background?: string;
    };
    elements: Array<{
      id: string;
      type: 'text' | 'chart' | 'image';
      layout: {
        canvas?: {
          x: number;
          y: number;
          w: number;
          h: number;
          zIndex: number;
        };
      };
      data: any;
      style?: any;
    }>;
  }>;
}
```

## 前端实现示例

### React + TypeScript 示例

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  kind?: 'chat' | 'tool';
  status?: string;
  toolName?: string;
  title?: string;
  timestamp: number;
  artifactIds?: string[];
}

interface Artifact {
  id: string;
  type: string;
  content: any;
  version: string;
  timestamp: number;
}

export function usePPTGeneration() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [artifacts, setArtifacts] = useState<Map<string, Artifact>>(new Map());
  const [currentProgress, setCurrentProgress] = useState<number>(0);
  const [sessionId] = useState(() => {
    const stored = localStorage.getItem('ppt-session-id');
    if (stored) return stored;
    const newId = uuidv4();
    localStorage.setItem('ppt-session-id', newId);
    return newId;
  });

  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    
    // 连接成功后初始化会话
    newSocket.on('connect', () => {
      console.log('Connected to server');
      newSocket.emit('chat:init', { sessionId });
    });

    // 监听消息开始
    newSocket.on('message:start', (data) => {
      setMessages(prev => [...prev, {
        id: data.id,
        role: data.role,
        content: '',
        timestamp: Date.now(),
        artifactIds: []
      }]);
    });

    // 监听消息内容
    newSocket.on('message:chunk', (data) => {
      setMessages(prev => prev.map(msg => 
        msg.id === data.id 
          ? { ...msg, content: msg.content + data.chunk }
          : msg
      ));
    });

    // 监听工具开始
    newSocket.on('tool:start', (data) => {
      setMessages(prev => [...prev, {
        id: data.id,
        role: 'assistant',
        content: '',
        kind: 'tool',
        status: data.status,
        toolName: data.toolName,
        title: data.title,
        timestamp: Date.now(),
        artifactIds: []
      }]);
    });

    // 监听工具 Artifact
    newSocket.on('tool:artifact', (data) => {
      const { artifact, messageId } = data;
      
      // 保存 Artifact
      setArtifacts(prev => new Map(prev).set(artifact.id, artifact));
      
      // 更新消息的 artifactIds
      setMessages(prev => prev.map(msg =>
        msg.id === messageId
          ? { ...msg, artifactIds: [...(msg.artifactIds || []), artifact.id] }
          : msg
      ));
    });

    // 监听工具更新
    newSocket.on('tool:update', (data) => {
      setMessages(prev => prev.map(msg =>
        msg.id === data.id
          ? { ...msg, status: data.status, content: data.content }
          : msg
      ));
    });

    // 监听进度
    newSocket.on('progress', (data) => {
      setCurrentProgress(data.progress);
    });

    // 监听完成
    newSocket.on('completion', (data) => {
      console.log('Generation completed:', data);
      if (data.finalArtifactId) {
        // 可以高亮显示最终产物
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [sessionId]);

  const sendMessage = (message: string) => {
    if (!socket) return;
    
    // 添加用户消息到界面
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: Date.now()
    }]);

    // 发送到服务器
    socket.emit('chat:send', {
      sessionId,
      message,
      metaData: {}
    });
  };

  return {
    messages,
    artifacts,
    currentProgress,
    sendMessage
  };
}
```

### UI 组件示例

```typescript
export function PPTGenerationUI() {
  const { messages, artifacts, currentProgress, sendMessage } = usePPTGeneration();
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="ppt-generation-container">
      {/* 消息列表 */}
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.role}`}>
            {msg.kind === 'tool' ? (
              <div className="tool-message">
                <div className="tool-header">
                  <span className="tool-icon">🔧</span>
                  <span className="tool-title">{msg.title}</span>
                  <span className={`status ${msg.status}`}>{msg.status}</span>
                </div>
                
                {/* 显示 Artifact */}
                {msg.artifactIds?.map(artifactId => {
                  const artifact = artifacts.get(artifactId);
                  if (!artifact) return null;
                  
                  return (
                    <div key={artifactId} className="artifact">
                      <div className="artifact-type">{artifact.type}</div>
                      <pre>{JSON.stringify(artifact.content, null, 2)}</pre>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="chat-message">
                {msg.content}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 进度条（仅在生成阶段显示） */}
      {currentProgress > 0 && currentProgress < 100 && (
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${currentProgress}%` }}
          />
          <span>{currentProgress}%</span>
        </div>
      )}

      {/* 输入框 */}
      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入 PPT 主题，例如：什么是 Agent"
        />
        <button type="submit">生成 PPT</button>
      </form>
    </div>
  );
}
```

## 关键注意事项

### 1. 会话管理
- 使用 `sessionId` 保持会话连续性
- 建议存储在 `localStorage` 中
- 刷新页面后可恢复历史消息

### 2. Artifact 展示
- 每个阶段都会产生一个 Artifact
- 建议为不同类型的 Artifact 设计不同的展示组件
- `showInCanvas` 为 `true` 时应在画布区域显示

### 3. 进度追踪
- 只有阶段 6（逐页生成）会发送 `progress` 事件
- 进度值范围：0-100
- 可以显示具体的页数信息

### 4. 错误处理
- 监听 `tool:update` 中的 `status: 'failed'`
- 监听 `completion` 中的 `success: false`
- 提供重试机制

### 5. 性能优化
- 使用虚拟滚动处理大量消息
- Artifact 内容较大时考虑懒加载
- 使用 React.memo 优化组件渲染

## 测试数据

参考项目根目录的 `data.json` 文件，其中包含了一次完整的 5 阶段生成流程的消息记录。

## 与旧流程的区别

| 特性 | 旧流程（3 阶段） | 新流程（5 阶段） |
|------|----------------|----------------|
| 阶段数 | 3 个 | 6 个 |
| Artifact 类型 | `requirement_analysis`, `plan`, `dsl` | `requirement_analysis`, `course_config`, `video_outline`, `slide_scripts`, `presentation_theme`, `dsl` |
| 进度追踪 | 无 | 有（阶段 6） |
| 主题定制 | 无 | 有（阶段 5） |
| 脚本预览 | 无 | 有（阶段 4） |

## 支持与反馈

如有问题，请查看：
- 后端日志：`pnpm run start:dev`
- WebSocket 连接：检查浏览器控制台
- Artifact 数据：使用 `data.json` 作为参考
