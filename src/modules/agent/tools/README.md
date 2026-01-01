# WebSearchTool 测试文档

## 概述

本目录包含 [`WebSearchTool`](./web-search.tool.ts:20) 的测试用例,用于验证博查搜索功能是否正常工作。
node
## 重要修复 (2026-01-02)

### 问题
博查搜索一直无法搜到信息,集成测试显示返回 0 个结果。

### 根本原因
1. **API URL 错误**: 代码中使用的是 `https://api.bochaai.com/v1/web-search`,正确的应该是 `https://api.bocha.cn/v1/web-search`
2. **API 响应结构不匹配**: 代码期望 `data.results`,但实际 API 返回的是 `data.webPages.value`
3. **字段映射错误**: API 返回的字段是 `name` 和 `summary`,代码中使用的是 `title` 和 `content`

### 修复内容
1. ✅ 修正 API URL 为 `https://api.bocha.cn/v1/web-search`
2. ✅ 更新 API 响应接口定义,匹配实际返回结构
3. ✅ 修正数据提取路径: `data.webPages.value`
4. ✅ 修正字段映射: `name` → `title`, `summary` → `snippet`
5. ✅ 添加详细日志用于调试

### 验证结果
- 单元测试: 7/7 通过 ✅
- 集成测试: 2/2 通过 ✅
- 真实 API 调用成功,能够返回搜索结果 ✅

## 测试文件

### 1. 单元测试 - [`web-search.tool.spec.ts`](./web-search.tool.spec.ts:1)

这是单元测试文件,使用 mock 来测试各种场景:

**测试用例:**
- ✅ 无 API key 时返回模拟数据
- ✅ 有 API key 时调用博查 API
- ✅ API 调用失败时返回模拟数据
- ✅ 处理空 API 响应
- ✅ 处理格式错误的 API 响应
- ✅ 返回正确数量的结果
- ✅ 正确映射 API 响应字段

**运行方式:**
```bash
npm test -- web-search.tool.spec.ts
```

### 2. 集成测试 - [`web-search.tool.integration.spec.ts`](./web-search.tool.integration.spec.ts:1)

这是集成测试文件,用于测试真实的博查 API 调用:

**测试用例:**
- ✅ 使用有效 API key 执行真实搜索
- ✅ 处理不同类型的查询

**运行方式:**
```bash
# 首先确保在 .env 文件中设置了 BOCHA_API_KEY
npm test -- web-search.tool.integration.spec.ts
```

**注意:**
- 集成测试需要有效的 `BOCHA_API_KEY`
- 如果没有 API key,测试会自动跳过并显示警告
- 集成测试会调用真实的博查 API,可能需要较长时间(30-60秒)

## 诊断博查搜索问题

如果你发现博查搜索无法搜到信息,可以按照以下步骤排查:

### 步骤 1: 运行单元测试
```bash
npm test -- web-search.tool.spec.ts
```

这会验证基本功能是否正常。所有测试应该通过。

### 步骤 2: 运行集成测试
首先检查 `.env` 文件中是否设置了 `BOCHA_API_KEY`:

```bash
# 查看环境变量
cat .env | grep BOCHA_API_KEY
```

然后运行集成测试:
```bash
npm test -- web-search.tool.integration.spec.ts
```

**如果测试跳过:**
- 说明没有设置 `BOCHA_API_KEY`
- 系统会使用模拟数据

**如果测试失败:**
- 查看 console 输出的详细信息
- 检查 API key 是否有效
- 检查网络连接
- 查看错误日志

### 步骤 3: 检查应用日志

在运行应用时,查看日志输出:

```bash
pnpm start:dev
```

查找以下日志:
- `BOCHA_API_KEY not found` - API key 未设置
- `Bocha search failed: <error>` - API 调用失败
- `Searching for: <query>` - 搜索请求已发送

### 步骤 4: 手动测试 API

如果集成测试失败,可以手动测试博查 API:

```bash
curl -X POST https://api.bocha.cn/v1/web-search \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test",
    "freshness": "noLimit",
    "summary": true,
    "count": 8
  }'
```

替换 `YOUR_API_KEY` 为你的实际 API key。

## 常见问题

### Q: 为什么搜索总是返回模拟数据?

A: 可能的原因:
1. `.env` 文件中没有设置 `BOCHA_API_KEY`
2. API key 无效或已过期
3. 网络连接问题导致 API 调用失败

### Q: 如何确认 API key 是否有效?

A: 运行集成测试:
```bash
npm test -- web-search.tool.integration.spec.ts
```

如果测试通过并显示实际搜索结果,说明 API key 有效。

### Q: 搜索结果为空怎么办?

A: 可能的原因:
1. 查询词过于生僻
2. API 返回了空结果
3. API 响应格式不符合预期

查看日志以获取更多信息。

## 测试覆盖率

当前测试覆盖了以下场景:
- ✅ 无 API key 的情况
- ✅ 有 API key 的情况
- ✅ API 调用成功
- ✅ API 调用失败
- ✅ 空响应
- ✅ 格式错误的响应
- ✅ 多个结果
- ✅ 字段映射

## 添加新测试

如果需要添加新的测试用例,可以参考现有的测试文件:

1. 单元测试在 [`web-search.tool.spec.ts`](./web-search.tool.spec.ts:1)
2. 集成测试在 [`web-search.tool.integration.spec.ts`](./web-search.tool.integration.spec.ts:1)

确保测试遵循以下原则:
- 每个测试只验证一个功能点
- 使用清晰的描述性测试名称
- 包含适当的断言
- 添加必要的注释
