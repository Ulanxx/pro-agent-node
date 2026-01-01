# Tasks: Add Iterative Feedback Flow

## Phase 1: Intent Recognition & Routing
- [x] Add `IntentClassifier` service to distinguish between new requests and feedback. <!-- id: 0 -->
- [x] Update `ChatService.handleMessage` to use the classifier. <!-- id: 1 -->
- [x] Implement a `findTargetStage` logic to map feedback to one of the 5 stages. <!-- id: 2 -->

## Phase 2: Refinement Logic in Chat5StageService
- [x] Add `refineStageX` methods for each of the 5 stages in `Chat5StageService`. <!-- id: 3 -->
- [x] Modify `handle5StagePPTGeneration` to accept an `entryStage` and `refinementContext`. <!-- id: 4 -->
- [x] Implement cascading re-generation (if stage N changes, re-run N+1...5). <!-- id: 5 -->

## Phase 3: Agent Service Enhancements
- [x] Update `AgentService` to support refinement prompts (input: old artifact + feedback). <!-- id: 6 -->
- [x] Ensure LLM knows how to "缩减大纲" or "增加配图". <!-- id: 7 -->

## Phase 4: UI & Socket Feedback
- [x] Update Socket events to indicate a "Refinement" is happening. <!-- id: 8 -->
- [x] Ensure UI can handle artifact versioning (v1, v2, etc.). <!-- id: 9 -->

## Validation
- [x] Test case: Generate PPT -> Feedback "too long" -> Verify Outline and Scripts are updated. <!-- id: 10 -->
- [x] Test case: Generate PPT -> Feedback "add images" -> Verify only Slide Generation stage re-runs. <!-- id: 11 -->
