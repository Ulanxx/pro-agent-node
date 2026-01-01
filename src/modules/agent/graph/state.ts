import { Annotation } from '@langchain/langgraph';
import {
  CourseConfig,
  VideoOutline,
  SlideScript,
  PresentationTheme,
  PptHtmlDocument,
} from '../../../core/dsl/types';
import { TargetStage } from '../intent-classifier.service';

/**
 * AgentState 定义了 LangGraph 中流转的状态
 */
export const AgentState = Annotation.Root({
  sessionId: Annotation<string>(),
  topic: Annotation<string>(),
  chatMessageId: Annotation<string>(),

  // 阶段产物 (DSL 对象)
  analysis: Annotation<string>(),
  courseConfig: Annotation<CourseConfig>(),
  videoOutline: Annotation<VideoOutline>(),
  slideScripts: Annotation<SlideScript[]>(),
  theme: Annotation<PresentationTheme>(),
  document: Annotation<PptHtmlDocument>(),

  // 运行元数据
  currentStage: Annotation<TargetStage>(),
  entryStage: Annotation<TargetStage>(),
  refinementPrompt: Annotation<string>(),
  error: Annotation<string>(),
});

export type AgentStateType = typeof AgentState.State;
