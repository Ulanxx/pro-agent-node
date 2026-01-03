import { JobStartMetaDataPayload } from './process';

export interface BaseMessage {
  content: string;
  metadata?: JobStartMetaDataPayload;
  timestamp: number;
  status: 'in_progress' | 'completed' | 'error';
}
export interface UserMessage extends BaseMessage {
  role: 'user';
}

export interface AssistantChatMessage extends BaseMessage {
  id: string;
  role: 'assistant';
  kind: 'chat';
}

export interface AssistantToolMessage extends BaseMessage {
  id: string;
  role: 'assistant';
  kind: 'tool';
  toolName: string;
  title?: string;
  progressText?: string;
  parentMessageId?: string;
  artifactIds?: string[];
}

export interface ToolMessagePatch {
  progressText?: string;
  content?: string;
  status?: 'in_progress' | 'completed' | 'error';
}

export type Message = UserMessage | AssistantChatMessage | AssistantToolMessage;
