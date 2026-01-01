# Change: Align Multi-Stage PPT Generation Flow

## Why
目前后端（Server）和前端（Web）在 PPT 生成流程的定义上存在差异：
1. 后端文档中提到的两阶段（Planning -> Generation）与前端对接文档中的 6 步流程（Analyze -> DSL）不一致。
2. 状态码（Status Codes）和事件名称在不同文档中存在冲突（如 `progress` 与 `message:start`/`tool:start` 的配合方式）。
3. 产物（Artifacts）的定义和生命周期在两端缺乏统一的契约，导致前端渲染逻辑碎片化。

## What Changes
- **统一流程定义**：采用“6 阶段流程”作为标准：
  1. 需求分析 (`analyze_topic`) -> `requirement_analysis` Artifact
  2. 课程配置 (`generate_course_config`) -> `course_config` Artifact
  3. 视频大纲 (`generate_video_outline`) -> `video_outline` Artifact
  4. 脚本生成 (`generate_slide_scripts`) -> `slide_scripts` Artifact
  5. 主题设计 (`generate_presentation_theme`) -> `presentation_theme` Artifact
  6. 逐页生成 (`generate_slides`) -> `dsl` Artifact
- **标准化事件流**：
  - 使用 `tool:start`, `tool:artifact`, `tool:update` 统一表示 AI 的思考和产物产出。
  - 仅在第六阶段（逐页生成）使用 `progress` 事件推送细粒度的进度条。
- **强化 Artifact 契约**：明确每个阶段产出的 JSON 结构，确保前后端类型安全。

## Impact
- **Affected specs**: `agent-interaction`, `socket-communication`
- **Affected code**:
  - Backend: `AgentService`, `SocketGateway`, `TaskQueue`
  - Frontend: `useSocket`, `useStore`, `ArtifactRenderer`
