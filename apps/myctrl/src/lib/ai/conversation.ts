export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export const DEFAULT_CONVERSATION_TURN_CAP = 12;
export const MAX_CONVERSATION_TURN_CHARS = 20000;

export function clipConversationHistory(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  cap = DEFAULT_CONVERSATION_TURN_CAP,
): ConversationTurn[] {
  return messages
    .filter((message) => message.content.trim().length > 0)
    .slice(-Math.max(0, cap))
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, MAX_CONVERSATION_TURN_CHARS),
    }));
}
