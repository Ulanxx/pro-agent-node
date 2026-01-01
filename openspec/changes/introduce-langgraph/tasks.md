## 1. Preparation & Prompt Refactoring
- [x] 1.1 安装依赖: `pnpm add @langchain/langgraph`
- [x] 1.2 重构 Prompt 配置: 将 `prompts/planning.prompt.ts` 中的 Prompt 整合为更易维护的配置对象
- [x] 1.3 创建目录: `src/modules/agent/graph`

## 2. Graph Core Implementation
- [x] 2.1 定义 `AgentState` (@/src/modules/agent/graph/state.ts)
- [x] 2.2 创建 `PptGraphService` (@/src/modules/agent/graph/ppt-graph.service.ts)
- [x] 2.3 实现各阶段 Node (封装 `AgentService` 逻辑)
- [x] 2.4 集成 Checkpointer 并完成 Graph 编译

## 3. Total Replacement
- [x] 3.1 更新 `AgentModule` 注册新服务
- [x] 3.2 重构 `Chat5StageService`：完全删除旧的过程式代码，改为调用 `PptGraphService`
- [x] 3.3 调整 Socket 通信逻辑，确保其与 Graph 节点状态同步
- [x] 3.4 清理 `AgentService` 中不再需要的旧方法（如果已被 Graph Node 替代）

## 4. Validation
- [x] 4.1 运行单元测试
- [x] 4.2 通过 Socket.io 验证完整生成流程
- [x] 4.3 验证断点恢复逻辑
