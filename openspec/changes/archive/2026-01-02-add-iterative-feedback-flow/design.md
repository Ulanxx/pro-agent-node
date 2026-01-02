# Design: Iterative Feedback Flow Architecture

## Architecture Overview

The current flow is:
`User Message` -> `ChatService` -> `Chat5StageService` -> `Linear Sequence of Stages`

The new flow will be:
`User Message` -> `ChatService` -> **`Flow Router`** -> **`Feedback Handler`** or **`Initial Generation`**

### 1. Flow Router (Intent Classification)
Before calling `handle5StagePPTGeneration`, the system will check the session history.
- If artifacts exist, the LLM will classify the message:
  - `INITIAL`: Start a fresh 5-stage flow.
  - `REFINEMENT`: User wants to modify something existing.
  - `CONTINUE`: (Optional) User confirming to proceed to next stage (if we add manual pauses).

### 2. State Management
We will use the existing Redis-based artifact storage but add a `stage_state` to track the current progress and dependency graph.
- `Requirement Analysis` -> `Course Config` -> `Video Outline` -> `Slide Scripts` -> `Theme` -> `Slides`
- If `Video Outline` is modified, all downstream artifacts (`Slide Scripts`, `Theme`, `Slides`) are marked as "stale" or need re-generation.

### 3. Feedback Handler
The feedback handler will determine the "Entry Point" in the 5-stage pipeline.
- If feedback targets "images", the entry point is `stageSlideGeneration`.
- If feedback targets "content length", the entry point is `stageVideoOutline`.

## LangChain vs LangGraph

| Feature | LangChain (Chains) | LangGraph | Manual State Machine (Current Choice) |
|---------|-------------------|-----------|-----------------------|
| **Loops** | Hard (Recursion) | Native | Switch-Case / Loop |
| **State** | External | Managed | Redis |
| **Complexity**| Low | High | Medium |

**Recommendation**: 
We will implement a **Manual State Machine** in `Chat5StageService` that mimics LangGraph's logic. This avoids adding new heavy dependencies while providing the necessary flexibility. If the logic becomes too complex, we will migrate to `langgraph`.

## Data Flow
1. User: "大纲太复杂了"
2. Router: Detects `REFINEMENT` targeting `video_outline`.
3. Handler: 
   - Loads existing `course_config`.
   - Calls `agentService.refineVideoOutline(oldOutline, feedback)`.
   - Saves new `video_outline`.
   - Cascades: calls `stageSlideScripts`, then `stagePresentationTheme`, then `stageSlideGeneration`.
