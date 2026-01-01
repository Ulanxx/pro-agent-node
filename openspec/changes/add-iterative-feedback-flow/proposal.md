# Proposal: Add Iterative Feedback Flow for PPT Generation

## Problem Statement
The current 5-stage PPT generation flow is a linear sequence of steps. Once the process starts, it proceeds from analysis to final slide generation without any intermediate intervention or the ability to handle user feedback after completion. 
Users need to be able to:
- Provide feedback after the PPT is generated (e.g., "Add more images", "Simplify the outline").
- Have the system recognize the feedback intent.
- Re-run or refine specific stages based on the feedback while preserving relevant context.

## Proposed Solution
We propose an **Iterative Feedback Flow** that allows the agent to jump back to any previous stage or perform refinement operations.

### Key Components:
1. **Intent Classifier**: A new step in the chat service to determine if a user message is a "New Request" or "Feedback on Existing Artifact".
2. **Context-Aware Stage Re-triggering**: The ability to re-invoke `Chat5StageService` methods with previous artifacts and the new feedback.
3. **LangGraph-like State Machine**: Although we might not immediately import `langgraph` if the overhead is too high, we will adopt its "State + Nodes + Edges + Cycles" pattern to manage the flow.

### Handling User Examples:
- **"PPT增加一些配图"**: 
  - Intent: Refine Slide Generation.
  - Action: Re-trigger `stageSlideGeneration` with an added instruction for "image inclusion".
- **"PPT大纲太复杂，缩减一点"**:
  - Intent: Modify Video Outline.
  - Action: Re-trigger `stageVideoOutline`, which then invalidates and triggers subsequent stages (`stageSlideScripts`, `stagePresentationTheme`, `stageSlideGeneration`).

## Goals
- Support multi-turn refinement of PPT artifacts.
- Maintain consistent state across sessions.
- Provide clear visual feedback to the user about which stage is being re-processed.

## Non-Goals
- Full implementation of LangGraph if a simpler state machine suffices.
- Supporting feedback on non-PPT generation flows (out of scope for now).
