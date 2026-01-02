# Autonomous Planning Infinite Loop Fix

## 📅 Date
2026-01-02

## 🐛 Problem Description

Autonomous planning was hitting the recursion limit (25 iterations) with the error:
```
GraphRecursionError: Recursion limit of 25 reached without hitting a stop condition
```

### Symptom
The system was stuck in an infinite loop:
1. Task fails with API error
2. Scheduler → Executor → Reflector cycle repeats
3. "No ready tasks found" but "Found pending tasks, continuing execution"
4. Loop continues until recursion limit

## 🔍 Root Cause Analysis

### Issue 1: Incorrect Task Status on Retry
When a task failed and was being retried, the code was setting:
```typescript
taskInList.status = TaskStatus.PENDING; // ❌ WRONG
```

But `TaskSchedulerService.getNextTask()` only selects tasks with `TaskStatus.READY`:
```typescript
const readyTasks = taskList.tasks.filter(
  (t) => t.status === TaskStatus.READY, // Only READY tasks
);
```

### Issue 2: State Synchronization Problem
The `executorNode` was updating `taskList.tasks` but not returning the updated task object:
```typescript
return {
  taskList, // Updated
  // currentTask was missing! ❌
  currentStage: 'retrying',
};
```

This caused `reflectorNode` to receive a stale `currentTask` with `status = FAILED`.

### Flow Diagram of the Bug
```
1. Task executes and fails → status = FAILED
2. executorNode catch block:
   - Updates taskList.tasks[i].status = PENDING (can't be selected!)
   - Returns state without currentTask
3. reflectorNode runs with old currentTask (status = FAILED)
4. decideNextStep checks state.currentTask.status === FAILED → returns 'continue'
5. schedulerNode.getNextTask() → finds no READY tasks → returns null
6. Repeat from step 3...
```

## ✅ Solution

### Fix 1: Set to READY on Retry
When retrying a task, set it to `READY` instead of `PENDING`:
```typescript
taskInList.status = TaskStatus.READY; // ✅ CORRECT
```

**Why?** A task being retried has already had its dependencies satisfied (it was executing), so it should be READY, not PENDING.

### Fix 2: Return Updated Task
Always return the updated task object in state:
```typescript
return {
  taskList,
  currentTask: taskInList, // ✅ Return updated task
  currentStage: 'retrying',
};
```

This ensures downstream nodes see the correct task status.

### Fix 3: Handle READY Status in decideNextStep
Added explicit handling for READY status:
```typescript
} else if (currentTask.status === TaskStatus.READY) {
  this.logger.log(`Task ${currentTask.id} is ready, continuing`);
  return 'continue';
}
```

## 📊 Code Changes

### Modified Files
1. **src/modules/agent/graph/autonomous-graph.service.ts**
   - Line 517: Changed `TaskStatus.PENDING` to `TaskStatus.READY` (retry case)
   - Line 524: Changed `TaskStatus.PENDING` to `TaskStatus.READY` (updateTaskStatus call)
   - Line 537: Added `currentTask: taskInList` to return statement
   - Line 557: Added `currentTask: taskInList` to skip case return statement
   - Line 590: Added `currentTask: taskInList` to fail case return statement
   - Lines 174-177: Added READY status handling in decideNextStep

**Total**: ~15 lines changed

## 🧪 Testing Strategy

### Manual Testing
1. Start the dev server: `npm run start:dev`
2. Connect a Socket.IO client
3. Send a message triggering autonomous planning
4. Verify that:
   - Tasks can retry without infinite loops
   - System progresses through all 6 stages
   - No recursion limit errors

### Expected Behavior After Fix
```
1. Task fails → status = FAILED
2. executorNode catch block:
   - Updates taskList.tasks[i].status = READY (can be selected!)
   - Updates retryCount
   - Returns currentTask with status = READY
3. reflectorNode runs with updated currentTask (status = READY)
4. decideNextStep checks state.currentTask.status === READY → returns 'continue'
5. schedulerNode.getNextTask() → finds the READY task → schedules it
6. executorNode executes the retry
7. Process continues until success or max retries reached
```

## 📚 Key Learnings

### LangGraph State Management
1. **State immutability**: LangGraph state is immutable between nodes
2. **Explicit returns**: Must explicitly return updated objects in state
3. **Reference tracking**: Modifying `taskList.tasks[i]` doesn't update `state.currentTask`

### Task Status Transition Rules
- **PENDING** → Task created, dependencies not yet checked
- **READY** → Dependencies satisfied, can be scheduled
- **IN_PROGRESS** → Currently executing
- **COMPLETED** → Finished successfully
- **FAILED** → Finished with error (will check retry/skip logic)
- **SKIPPED** → Non-critical task failed after max retries

**Critical**: Only READY tasks can be selected by `getNextTask()`!

## 🔄 Related Issues

This fix complements the earlier work on autonomous planning:
- Commit bd8e5a0: Initial fixes (artifacts, error recovery, state checking)
- Commit [NEW]: This infinite loop fix

## 📝 Checklist for Future Error Handling

When modifying task state:
- [ ] Update `taskList.tasks[i]` directly
- [ ] Call `TaskSchedulerService.updateTaskStatus()` if needed
- [ ] Return the updated task object in state
- [ ] Ensure the status is appropriate for the next stage
  - Retry → READY (not PENDING)
  - New task → PENDING (later becomes READY)
  - Completed → COMPLETED
  - Failed → FAILED (or SKIPPED if non-critical)

## 🎯 Impact

- ✅ Fixes infinite loop during task retries
- ✅ Allows autonomous planning to complete all 6 stages
- ✅ Improves error recovery reliability
- ✅ No breaking changes to existing functionality

---

**Status**: Ready for commit and testing
**Estimated Risk**: Low (isolated change to error handling logic)
