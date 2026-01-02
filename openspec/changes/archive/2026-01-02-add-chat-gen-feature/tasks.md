## 1. Foundation & Configuration
- [x] 1.1 Verify `.env` supports `OPENAI_BASEURL` and `OPENAI_MODEL` (google/gemini-3-flash-preview)
- [x] 1.2 Update `AgentService` to inject and use these environment variables

## 2. Chat & Protocol Implementation
- [x] 2.1 Define WebSocket events for chat (`chat:send`, `chat:status`, `chat:progress`) in `SocketGateway`
- [x] 2.2 Implement `ChatService` to manage conversation history and session state
- [x] 2.3 Integrate `AgentService` into the chat flow for multi-stage generation (Planning -> Content)

## 3. Artifact Management
- [x] 3.1 Define `Artifact` data structure and persistence logic (Redis)
- [x] 3.2 Implement `ArtifactService` to track and update PPT DSL and file versions
- [x] 3.3 Emit `artifact:update` events during the generation process

## 4. Render & Feedback Loop
- [x] 4.1 Update `PptProcessor` to associate jobs with chat sessions and artifacts
- [x] 4.2 Ensure rendering progress is piped back to the chat session

## 5. Validation & Testing
- [x] 5.1 Add integration tests for the WebSocket chat flow
- [x] 5.2 Verify end-to-end "Manus-style" interaction using a test client
