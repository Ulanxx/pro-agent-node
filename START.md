# Project StartBuild: AnyGenAgent (Phase 1)

> **Context**: This document defines the architectural blueprint for "AnyGenAgent", a NestJS-based system that generates structured presentation documents (PPT) via an Agentic Workflow.

## 1. Project Identity
- **Name**: AnyGenAgent
- **Core Function**: Converts natural language prompts into editable PPTX files.
- **Philosophy**: **JSON DSL First**. We generate a platform-agnostic JSON Intermediate Representation (IR) first, then render it to PPTX/Web/PDF via adapters.

## 2. Technical Stack (Strict Constraints)
All code generated must adhere to these choices. Do NOT hallucinate other stacks.

- **Runtime**: Node.js (LTS)
- **Framework**: **NestJS v10** (Modular Architecture)
- **Language**: TypeScript 5.x (Strict Mode)
- **LLM Orchestration**: **LangChain.js** (`@langchain/openai`, `@langchain/core`)
  - *Constraint*: MUST use `.withStructuredOutput()` based on Zod schemas for all generation tasks.
- **Validation**: **Zod** (Schema Source of Truth)
- **Real-time**: **Socket.io** (`@nestjs/platform-socket.io`)
- **State/Queue**: 
  - **Redis** (via `ioredis`) for Agent State Persistence.
  - **BullMQ** for async generation tasks.
- **Rendering**: `pptxgenjs` (for Phase 1).

## 3. The Core Omni-DSL (Schema Definition)

This is the "Constitution" of our data structure. All Agents must output data matching this interface.

### 3.1 TypeScript Interfaces (`src/core/dsl/types.ts`)

```typescript
export type LayoutMode = 'canvas' | 'flow';
export type ComponentType = 'text' | 'image' | 'chart';

// The decoupling layer between PPT (absolute) and Web (flow)
export interface LayoutConfig {
  canvas?: { x: number; y: number; w: number; h: number; zIndex: number }; // Percentage (0-100)
  flow?: { align: 'left' | 'center' | 'right'; padding?: number[] };
}

export interface BaseComponent {
  id: string;
  type: ComponentType;
  layout: LayoutConfig;
}

export interface TextComponent extends BaseComponent {
  type: 'text';
  data: {
    content: string; // Markdown supported
    role: 'title' | 'subtitle' | 'body';
  };
  style?: { color?: string; fontSize?: number };
}

export interface ChartComponent extends BaseComponent {
  type: 'chart';
  data: {
    chartType: 'bar' | 'line' | 'pie';
    title: string;
    labels: string[];
    datasets: { label: string; values: number[] }[];
  };
}

export type AnyComponent = TextComponent | ChartComponent;

export interface SlidePage {
  id: string;
  meta: { title: string; speakNotes?: string; background?: string };
  elements: AnyComponent[];
}

export interface AnyGenDocument {
  title: string;
  meta: { theme: string; aspectRatio: '16:9' };
  pages: SlidePage[];
}

```

## 4. Architecture & Directory Structure

Establish this folder structure immediately.

```text
src/
├── app.module.ts
├── core/
│   ├── dsl/                 # Zod Schemas & TS Types
│   ├── config/              # Env Config
│   └── interceptors/        # Response Formatting
├── modules/
│   ├── agent/               # The "Brain"
│   │   ├── agent.service.ts # Main Orchestrator (State Machine)
│   │   ├── chains/          # LangChain Definitions (OutlineChain, PageChain)
│   │   └── prompts/         # System Prompts
│   ├── render/              # The "Hands"
│   │   ├── render.service.ts
│   │   └── adapters/
│   │       └── ppt.adapter.ts
│   └── socket/              # Real-time Communication
└── shared/
    └── utils/

```

## 5. Implementation Roadmap (Phase 1)

### Step 1: Foundation

1. Initialize NestJS project.
2. Install dependencies: `langchain @langchain/openai zod pptxgenjs socket.io redis ioredis bullmq`.
3. Set up the `src/core/dsl` folder with both TS Interfaces and Zod Schemas.

### Step 2: The Agent "Brain" (LangChain + Zod)

1. Create `AgentService`.
2. Implement **Structured Generation**:
* Input: User Topic (e.g., "Q3 Financial Report").
* Process: LangChain Model (`google/gemini-3-flash-preview`) -> `withStructuredOutput(documentSchema)`.
* Output: Valid JSON complying with `AnyGenDocument`.


3. **Crucial**: Implement the Chart Generation logic. If the user asks for data visualization, the LLM must generate valid `ChartComponent` data with realistic numbers.

### Step 3: The Renderer "Hands"

1. Create `PptAdapter` class.
2. Implement mapping logic:
* Iterate through `doc.pages`.
* Map `LayoutConfig.canvas` (0-100%) to `pptxgenjs` coordinates (inches/cm).
* Render Text and Charts using `pptxgenjs` APIs.


3. Return a Buffer/Stream of the `.pptx` file.

### Step 4: Connecting the Loop

1. Create a Controller/Gateway.
2. Flow: `POST /generate` -> AgentService (Generate JSON) -> RenderService (JSON to PPTX) -> Return File.

## 6. Critical Rules for Coding

1. **No XML**: Do not use XML for intermediate data. Use the JSON DSL defined above.
2. **Type Safety**: Use `z.infer<typeof schema>` to generate TS types from Zod schemas to ensure sync.
3. **Mocking**: For Step 1-2, if OpenAI Key is missing, create a `MockLLMService` that returns a hardcoded valid JSON DSL to test the renderer.

---

**Instruction to Cursor**:
Please analyze the requirements above.
Start by creating the **Directory Structure** and the **DSL Definitions (Zod & TS)**.
Then, ask me for confirmation before implementing the Agent Service.
