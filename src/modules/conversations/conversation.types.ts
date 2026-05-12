export type ChatRole = 'user' | 'assistant';

export interface StoredMessage {
  role: ChatRole;
  content: string;
  timestamp: string;
}

export interface ClientInfo {
  name?: string | null;
  email?: string | null;
}
