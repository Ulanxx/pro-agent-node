# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**AnyGenAgent** is a NestJS-based system that converts natural language prompts into structured, editable PowerPoint presentations through an Agentic Workflow. The core philosophy is **JSON DSL First**: generate a platform-agnostic JSON Intermediate Representation (IR), then render to PPTX via adapters.

## Common Development Commands

### Build and Run
```bash
# Install dependencies (uses pnpm)
pnpm install

# Development mode with hot reload
pnpm start:dev

# Production build
pnpm build

# Production mode
pnpm start:prod

# Debug mode with inspector
pnpm start:debug
```

### Testing
```bash
# Run unit tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run e2e tests
pnpm test:e2e

# Generate test coverage
pnpm test:cov

# Debug tests
pnpm test:debug
```

### Code Quality
```bash
# Lint and auto-fix
pnpm lint

# Format code with Prettier
pnpm format
```

### Prerequisites
- Redis must be running (required for BullMQ queue and agent state)
- Default connection: `localhost:6379`
- Configure via `REDIS_HOST` and `REDIS_PORT` environment variables

## Architecture

### Core Principles

1. **DSL-Driven Development**: All business logic revolves around the `AnyGenDocument` JSON DSL, enabling decoupling between generation and rendering
2. **Two-Stage Agentic Workflow**:
   - **Planning Stage**: Analyze topic → Generate outline (`DocumentPlan`)
   - **Content Generation Stage**: Transform plan → Full DSL (`AnyGenDocument`)
3. **Structured Output**: All LLM interactions use `.withStructuredOutput()` with Zod schemas for type-safe generation
4. **Async Processing**: Long-running tasks handled by BullMQ with real-time WebSocket progress updates

### Directory Structure

```
src/
├── core/
│   ├── dsl/                    # Source of truth: Zod schemas & TypeScript types
│   ├── config/                 # Environment configuration
│   └── interceptors/           # Response formatting
├── modules/
│   ├── agent/                  # AI orchestration ("Brain")
│   │   ├── agent.service.ts    # Main orchestrator with state machine
│   │   ├── chains/             # LangChain definitions
│   │   ├── prompts/            # System prompts for planning & generation
│   │   └── tools/              # Web search and other tools
│   ├── render/                 # Rendering engine ("Hands")
│   │   ├── render.service.ts   # Rendering orchestration
│   │   ├── ppt.processor.ts    # BullMQ async processor
│   │   └── adapters/
│   │       └── ppt.adapter.ts  # pptxgenjs implementation
│   └── socket/                 # Real-time progress updates
└── shared/
    └── utils/
```

### The DSL (Domain-Specific Language)

All schemas live in `src/core/dsl/types.ts`:

- **Core Types**: `AnyGenDocument` → `SlidePage` → `AnyComponent` (text/chart/image)
- **Layout System**: Uses percentage-based coordinates (0-100) for cross-platform compatibility
- **Type Safety**: TypeScript types auto-derived from Zod schemas via `z.infer<>`

When modifying the DSL:
1. Update Zod schema first in `src/core/dsl/types.ts`
2. TypeScript types auto-generate via `z.infer<>`
3. Update prompts in `src/modules/agent/prompts/` to match new schema
4. Update rendering logic in `src/modules/render/adapters/ppt.adapter.ts`

### Mock Mode

When `OPENAI_API_KEY` is missing, the system automatically uses mock data to enable testing without LLM calls:
- `AgentService` returns hardcoded `DocumentPlan` and `AnyGenDocument`
- WebSearchTool returns mock search results
- Check logs for "using MockLLMService logic" warning

## API Endpoints

### Synchronous Generation
```
POST /generate
Body: { "topic": "Your topic here" }
Returns: .pptx file stream (direct download)
```

### Asynchronous Generation (Recommended)
```
POST /generate/async
Body: { "topic": "Your topic", "sessionId": "optional-session-id" }
Returns: { "jobId": "...", "sessionId": "...", "message": "..." }
```

### WebSocket Events (Socket.io)
- Connect to server on port 3000
- Emit `subscribe` with `jobId` to receive updates
- Listen for `progress` events (status, progress percentage, message)
- Listen for `completion` event (final document + download URL)

## Environment Variables

Create a `.env` file:
```bash
# Required for real LLM generation (otherwise uses mock mode)
OPENAI_API_KEY=your_key_here
OPENAI_BASEURL=optional_custom_endpoint
OPENAI_MODEL=google/gemini-3-flash-preview  # default model

# Redis configuration (required)
REDIS_HOST=localhost
REDIS_PORT=6379

# Server port
PORT=3000
```

## OpenSpec Workflow

This project uses OpenSpec for spec-driven development. When working on features:

1. **Check for proposals**: `openspec list` to see active changes
2. **Review specs**: `openspec list --specs` for existing capabilities
3. **For significant changes**: Create a proposal following guidelines in `openspec/AGENTS.md`
4. **Always validate**: `openspec validate --strict` before committing

Key OpenSpec concepts:
- `openspec/specs/` - Current implemented features (source of truth)
- `openspec/changes/` - Proposed changes not yet implemented
- Use ADDED/MODIFIED/REMOVED/RENAMED requirements in delta specs

Refer to `openspec/AGENTS.md` for complete workflow instructions.

## Technology Stack

- **Framework**: NestJS v10 (modular architecture)
- **Language**: TypeScript 5.x (strict mode enabled)
- **LLM**: LangChain.js (`@langchain/openai`, `@langchain/core`)
- **Validation**: Zod (all DSL definitions have corresponding schemas)
- **Queue**: BullMQ + Redis (ioredis)
- **WebSocket**: Socket.io (`@nestjs/platform-socket.io`)
- **PPT Rendering**: pptxgenjs
- **Testing**: Jest (unit, e2e, coverage)

## Development Guidelines

### Code Style
- Follows NestJS official modular structure
- TypeScript strict mode enforced
- Use Prettier and ESLint (configs in root)
- Git commit messages in Chinese

### When Adding Features

1. **DSL Changes**: Always update Zod schema first, types follow automatically
2. **LLM Integration**: Use `.withStructuredOutput(YourZodSchema)` for all LLM calls
3. **Async Tasks**: Long-running operations go through BullMQ processors
4. **Real-time Updates**: Emit progress via SocketGateway during async operations
5. **Testing**: Write tests for new schemas, services, and API endpoints

### Common Pitfalls

- **Redis not running**: System will fail at startup; start Redis first
- **Missing API key**: System works in mock mode but won't generate real content
- **Schema mismatch**: If LLM output fails validation, update prompts to match schema structure
- **Layout coordinates**: DSL uses 0-100 percentages, pptxgenjs needs conversion to inches/cm

## Testing Strategy

- **Unit tests**: Co-located with source files (*.spec.ts)
- **E2E tests**: Located in `test/` directory
- **Mock services**: Use when `OPENAI_API_KEY` is unavailable
- Run full test suite before creating PRs

## Related Documentation

- `START.md` - Original architectural blueprint
- `FRONTEND_STARTUP.md` - Frontend integration guide (React/Vite)
- `openspec/project.md` - Project conventions and domain context
- `openspec/AGENTS.md` - Spec-driven development workflow
