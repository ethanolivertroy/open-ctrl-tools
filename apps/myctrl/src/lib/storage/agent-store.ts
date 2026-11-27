import { getDb, type AgentConversation, type AgentThreadMode } from '../db';
import type { MyCtrlDB } from '../db-runtime';

const DEFAULT_AGENT_THREAD_MODE: AgentThreadMode = 'per-session';

async function openDb(): Promise<MyCtrlDB> {
  return getDb();
}

export async function getAgentThreadMode(): Promise<AgentThreadMode> {
  if (typeof window === 'undefined') return DEFAULT_AGENT_THREAD_MODE;
  try {
    const db = await openDb();
    const setting = await db.settings.get('agent-thread-mode');
    return (setting?.value as AgentThreadMode) || DEFAULT_AGENT_THREAD_MODE;
  } catch {
    return DEFAULT_AGENT_THREAD_MODE;
  }
}

export async function setAgentThreadMode(mode: AgentThreadMode): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openDb();
  await db.settings.put({ key: 'agent-thread-mode', value: mode });
}

export async function saveAgentConversation(conversation: AgentConversation): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openDb();
  await db.agentConversations.put(conversation);
}

export async function getAgentConversation(id: string): Promise<AgentConversation | undefined> {
  if (typeof window === 'undefined') return undefined;
  const db = await openDb();
  return db.agentConversations.get(id);
}

export async function getAgentConversationsForControl(
  assessmentId: string,
  controlId: string,
): Promise<AgentConversation[]> {
  if (typeof window === 'undefined') return [];
  try {
    const db = await openDb();
    return await db.agentConversations
      .where('[assessmentId+controlId]')
      .equals([assessmentId, controlId])
      .reverse()
      .sortBy('updatedAt');
  } catch {
    return [];
  }
}

export async function getAllAgentConversations(): Promise<AgentConversation[]> {
  if (typeof window === 'undefined') return [];
  try {
    const db = await openDb();
    return await db.agentConversations.orderBy('updatedAt').reverse().toArray();
  } catch {
    return [];
  }
}

export async function deleteAgentConversation(id: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openDb();
  await db.agentConversations.delete(id);
}

export async function clearAllAgentConversations(): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openDb();
  await db.agentConversations.clear();
}

export async function exportAgentConversationsAsMarkdown(): Promise<string> {
  const conversations = await getAllAgentConversations();
  if (conversations.length === 0) return '# GRCLanker Conversations\n\nNo conversations saved.';

  const lines = ['# GRCLanker Conversations', '', `Exported: ${new Date().toISOString()}`, ''];

  for (const conversation of conversations) {
    lines.push(`## ${conversation.controlId} — ${new Date(conversation.createdAt).toLocaleDateString()}`);
    lines.push(`Framework: ${conversation.frameworkId} | Assessment: ${conversation.assessmentId}`);
    lines.push('');
    for (const message of conversation.messages) {
      const role = message.role === 'user' ? '**You**' : '**GRCLanker**';
      lines.push(`${role} (${new Date(message.timestamp).toLocaleTimeString()}):`);
      lines.push('');
      lines.push(message.content);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}
