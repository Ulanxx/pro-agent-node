# Change: Introduce LangGraph for Agentic Workflow

## Why
目前 Agent 的生成流程（5阶段 PPT 生成）是在 `Chat5StageService` 中通过硬编码的线性逻辑实现的。这种方式存在以下局限性：
1. **状态管理困难**：手动维护 `Artifact` 和局部变量，逻辑分散。
2. **流程控制死板**：难以实现复杂的循环（如：用户对大纲不满意要求重做）、条件分支或多步回溯。
3. **断点续传成本高**：手动判断 `entryStage` 逻辑复杂且易错。
4. **缺乏标准编排**：随着 Agent 逻辑变复杂，维护成本将呈指数级增长。

引入 LangGraph 可以提供声明式的图结构、内置的状态管理、断点支持（Human-in-the-loop）以及更好的循环支持。

## What Changes
- **引入 LangGraph 框架**：安装 `@langchain/langgraph`。
- **重构编排层**：全面重构 `Chat5StageService`，将其核心逻辑迁移至基于 LangGraph 的 `PptGraphService`。
- **状态统一化**：定义 `AgentState` 结构，利用 LangGraph 的 `Annotation` 机制管理。
- **Prompt 集中化维护**：优化 `AgentService` 中的 Prompt 配置，采用更清晰的对象结构或独立配置文件，方便维护和调试。
- **解耦业务逻辑**：`AgentService` 继续保留作为能力层，Graph Node 仅负责调用和状态更新。
- **增强持久化**：利用 LangGraph 的 Checkpointer 机制。
- **优化断点机制**：支持更优雅的中断和从特定节点恢复执行。

## Impact
- **Affected specs**: `agent-interaction` (新增图执行和状态恢复相关的需求)
- **Affected code**: 
    - `src/modules/agent/agent.module.ts` (注册新服务)
    - `src/modules/agent/chat-5-stage.service.ts` (全面重构逻辑)
    - `src/modules/agent/agent.service.ts` (优化 Prompt 加载逻辑)
    - `package.json` (新增依赖)
