# Project StartBuild: AnyGen Frontend (Genspark/Manus Ultra Style)

> **Context**: This blueprint defines a high-end React frontend for AnyGenAgent, meticulously mimicking the Genspark AI / Manus.ai interactive experience. It features a deep reasoning pane, tool execution logs, and a high-fidelity slide canvas.

## 1. Technical Stack
- **Bundler**: Vite
- **Framework**: React 18+ (TypeScript)
- **Styling**: Tailwind CSS (Dark Mode Primary)
- **UI Components**: 
  - **Ant Design v6**: Base components
  - **Ant Design X**: AI components (`ThoughtChain`, `Bubble`, `Sender`, `Welcome`)
- **Icons**: Lucide React
- **Communication**: Socket.io-client
- **State Management**: Zustand (Session, Thoughts, Tools, Artifacts)

## 2. Visual Identity (Genspark AI Style)
- **Primary Theme**: Absolute Dark (`bg-[#0a0a0a]`) with subtle borders (`border-[#1f1f1f]`).
- **Layout**: 
  - **Sidebar (Ultra Slim)**: Fixed 64px width, icons: `Plus` (New), `Home`, `Inbox` (AI 收件箱), `Layout` (工作区), `Cloud` (AI 云盒).
  - **Main Container**: Flex Split-screen.
  - **Left Panel (Chat & Reasoning)**: `bg-[#111111]`. Stacked structure: Top Nav (Back/Menu) -> Chat History -> **Thought Process (AntD X ThoughtChain)** -> **Tool Usage Logs** -> Bottom Sender.
  - **Right Panel (Canvas)**: `bg-[#0a0a0a]`. Professional header with "Editable Title", "Share", "Add", and "..." buttons. Central area is the **High-Fidelity PPT Canvas**.

## 3. Component Architecture
```text
src/
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx          # Vertical slim nav with specific icons
│   │   └── MainContainer.tsx    # Split-pane with draggable divider
│   ├── chat/
│   │   ├── ChatPane.tsx         # Left panel: history + reasoning
│   │   ├── ThoughtProcess.tsx   # AntD X ThoughtChain (Checklist: Analyzing, Planning, Generating)
│   │   ├── ToolUsageLogs.tsx    # Horizontal logs like "使用工具 | 读取 URL... [查看]"
│   │   └── ChatBubble.tsx       # AntD X Bubble for user/bot messages
│   ├── canvas/
│   │   ├── CanvasHeader.tsx     # Title bar with share/export
│   │   ├── SlideCanvas.tsx      # Central preview: renders the current slide
│   │   └── DSLRenderer.tsx      # High-fidelity rendering of AnyGenDocument JSON
│   └── ui/
│       └── ProSender.tsx        # specialized AntD X Sender with 'Stop' and 'Attachments'
├── hooks/
│   └── useAnyGenSocket.ts       # Centralized socket event handling
├── store/
│   └── useChatStore.ts          # State for messages, checklists, and DSL
└── App.tsx
```

## 4. Key Interactive Flows (Manus Style)

### 4.1 The "Reasoning" phase
- **ThoughtChain**: Dynamic checklist showing Agent's internal todos.
- **Real-time Tool Logs**: When the Agent "reads a URL" or "searches", show a specific log entry with a "View" action button.
- **Typewriter Effect**: AI messages should stream in with a smooth character-by-character animation.

### 4.2 The "Incremental Evolution" phase
- **Artifact Evolution**: As `artifact:update` events arrive:
  - First, show the **Planning View** (List of slides).
  - Then, as content is generated, transition to the **Slide Canvas View**.
- **Canvas Fidelity**: Slides should have professional themes, layout, and rendered charts (if applicable).

## 5. Initialization Command
```bash
pnpm create vite . --template react-ts
pnpm add antd @ant-design/x lucide-react socket.io-client zustand
pnpm add -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

---

## 6. Premium Instructions for Windsurf
1.  **Strict Dark Mode**: Use `ant-design` `ConfigProvider` with `theme.darkAlgorithm`. Override primary colors to match the Genspark aesthetic (White/Gray/Blue accents).
2.  **Split-Pane Container**: Use a flex layout where the divider is clearly defined by `border-[#1f1f1f]`.
3.  **ThoughtChain Integration**: 
    - When `progress` arrives with status 'planning', mark the "规划幻灯片大纲" item as in-progress.
    - Support nested "Tool Logs" within the reasoning flow.
4.  **High-Performance Canvas**: The right panel must feel like a "Canvas", where elements (Text, Charts) are rendered according to their `LayoutConfig` (0-100% percentages).
5.  **Interactive Elements**: Input area should have the attachment (Paperclip), Mic, and Send/Stop icons exactly as shown in the Manus screenshot.
