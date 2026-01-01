# Change: Add Chat Gen Feature with Manus-like UI

## Why
用户希望实现一个类似 Manus 的智能体应用，能够通过对话（Chat Gen）自动规划并生成 PPT 物料及内容。当前的 PPT 生成流程是单向的 API 调用，缺乏交互式的对话体验和物料/产物的实时预览能力。

## What Changes
- **ADDED** 对话式生成接口 (WebSocket/REST)，支持流式进度反馈。
- **ADDED** 物料规划 (Planning) 与内容生成 (Content) 的分阶段展示。
- **ADDED** 类似 Manus 的侧边栏产物预览 (Artifacts Viewer) 功能。
- **MODIFIED** `AgentService` 以支持更灵活的对话上下文和多模型切换（已初步支持 Gemini 3 Flash）。

## Impact
- **Affected Specs**: `chat`, `artifacts` (新能力)。
- **Affected Code**: `src/modules/agent/agent.service.ts`, `src/modules/socket/socket.gateway.ts`, `src/modules/render/ppt.processor.ts`。
- **UI/UX**: 引入分屏交互，左侧对话，右侧产物/物料实时渲染预览。
