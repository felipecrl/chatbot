export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolParametersSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParametersSchema;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

export interface ChatTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatRequest {
  systemPrompt: string;
  messages: ChatMessage[];
  tools: ChatTool[];
}

export interface ChatResult {
  text: string | null;
  usage?: TokenUsage;
}

export interface AiService {
  chat(request: ChatRequest): Promise<ChatResult>;
  /** Returns true if the text is real-estate related; false if off-topic. Fails open on error. */
  classify(text: string): Promise<boolean>;
}
