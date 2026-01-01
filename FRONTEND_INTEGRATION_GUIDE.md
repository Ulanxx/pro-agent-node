# AnyGen Frontend Integration Guide (for Windsurf)

> **Role**: As the Frontend AI Engineer, use this guide to implement the connection between the React frontend and the NestJS backend.

## 1. Connection Details
- **Base URL**: `http://localhost:3000`
- **Protocol**: Socket.io (v4)
- **Session Management**: Generate a persistent `sessionId` (e.g., UUID stored in localStorage) to maintain context across refreshes.

## 2. WebSocket Events (The Contract)

### 2.1 Outbound (Client -> Server)
| Event | Payload | Description |
| :--- | :--- | :--- |
| `chat:init` | `{ sessionId: string }` | Call this on app load. Returns `{ status, artifacts: Artifact[] }`. |
| `chat:send` | `{ message: string, sessionId: string }` | Send user prompt/topic. |

### 2.2 Inbound (Server -> Client)
| Event | Payload | UI Action |
| :--- | :--- | :--- |
| `progress` | `{ status: string, progress: number, message: string }` | Update `ThoughtChain` state and top progress bar. |
| `tool:log` | `{ id, tool, action, status, timestamp }` | Append a tool execution record to the chat stream. |
| `artifact:update` | `Artifact` | Upsert artifact in the right-side Canvas/Gallery. Newest first. |
| `completion` | `{ success: boolean, result, error? }` | Finalize generation, re-enable input, show success/error toast. |

## 3. Handling 'Progress' Status (State Mapping)
Map the `status` field from the `progress` event to the `ThoughtChain` checklist items:

| Status Code | ThoughtChain Label | Description |
| :--- | :--- | :--- |
| `analyzing` | 分析主题需求 | Initial requirement analysis. |
| `planning` | 规划幻灯片大纲 | When `Artifact` type `plan` is expected. |
| `gathering` | 收集核心物料 | Usually accompanied by `tool:log` events. |
| `generating` | 生成详细内容 | When `Artifact` type `dsl` starts appearing. |
| `designing` | 视觉设计与渲染 | Final polish and PPTX buffer preparation. |

## 4. Artifact Types & Rendering
| Type | Content Structure | Rendering Hint |
| :--- | :--- | :--- |
| `plan` | `{ title, outline: Array<{title, description}> }` | Render as a structured list/TOC in the Canvas. |
| `dsl` | `AnyGenDocument` (JSON) | Render high-fidelity slide previews (16:9 cards). |
| `pptx` | `{ filename, downloadUrl }` | Render the prominent orange Download Button card. |

## 5. Implementation Strategy for Windsurf
1.  **Initialize Zustand Store**: Create a `useStore` that holds `messages: Message[]`, `artifacts: Artifact[]`, and `currentStatus: Progress`.
2.  **Create `useSocket` Hook**:
    *   On mount: `socket.emit('chat:init', { sessionId })`.
    *   Handle `artifact:update`: If ID exists, replace; else prepend to `artifacts` array.
    *   Handle `tool:log`: Treat as a special message type in the chat stream.
3.  **UI Polish**:
    *   Ensure the `SlideCanvas` (Right Panel) automatically scrolls to/focuses on the latest artifact.
    *   Use `framer-motion` for smooth entries of bubbles and cards.
    *   Match the **Manus/Genspark** aesthetic: `#0a0a0a` backgrounds, `#1f1f1f` borders, and Blue/White accents.
