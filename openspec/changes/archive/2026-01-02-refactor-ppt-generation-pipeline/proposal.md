# Change: 重构 PPT 生成为确定的 5 步骤流程

## Why
当前的 PPT 生成流程只有 3 个阶段（分析、规划、内容生成），缺乏对课程配置、讲解视频大纲、PPT 脚本、主题风格和逐页生成的明确支持。需要将流程重构为 5 个确定的步骤，以支持更专业的教学视频 PPT 生成场景。

## What Changes
- **新增课程配置生成阶段**：生成叙事风格、目标受众等课程元信息
- **新增讲解视频大纲阶段**：生成主题、知识单元、知识点的层级结构
- **重构 PPT 脚本生成**：为每一页生成幻灯片内容设计、可视化建议、口播稿的完整脚本数组
- **新增 PPT 主题风格和母版阶段**：生成统一的视觉主题和母版配置
- **新增逐页 PPT 生成阶段**：循环 PPT 脚本，根据每页内容逐个生成 PPT 页面
- **BREAKING**: 修改现有的 `DocumentPlan` 和 `AnyGenDocument` DSL 结构

## Impact
- **Affected specs**: `agent-interaction` (新增多阶段流程)
- **Affected code**: 
  - `src/core/dsl/types.ts` (新增 DSL 类型)
  - `src/modules/agent/agent.service.ts` (重构生成流程)
  - `src/modules/agent/chat.service.ts` (更新工具调用流程)
  - `src/modules/agent/prompts/planning.prompt.ts` (新增和修改 prompts)
  - `src/modules/render/adapters/ppt.adapter.ts` (支持主题和母版)
