export interface UserMessage {
  role: 'user';
  content: string;
  timestamp: number;
}

export interface AssistantChatMessage {
  id: string;
  role: 'assistant';
  kind: 'chat';
  content: string;
  timestamp: number;
}

export interface AssistantToolMessage {
  id: string;
  role: 'assistant';
  kind: 'tool';
  status: 'in_progress' | 'completed' | 'error';
  toolName: string;
  title?: string;
  content: string;
  progressText?: string;
  parentMessageId?: string;
  artifactIds?: string[];
  timestamp: number;
}

export interface ToolMessagePatch {
  progressText?: string;
  content?: string;
  status?: 'in_progress' | 'completed' | 'error';
}

export type Message = UserMessage | AssistantChatMessage | AssistantToolMessage;
