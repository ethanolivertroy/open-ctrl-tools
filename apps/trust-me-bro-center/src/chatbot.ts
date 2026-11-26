import type { publicSnapshot } from './domain';

export type Snapshot = ReturnType<typeof publicSnapshot>;

export interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface ChatSource {
  id: string;
  kind: 'faq' | 'control' | 'document' | 'subprocessor' | 'certification' | 'data' | 'update' | 'profile';
  title: string;
  text: string;
}

export interface ChatAnswer {
  reply: string;
  references: string[];
  mode: 'ai' | 'retrieval';
}

export const CHAT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'do', 'does', 'you', 'your', 'we', 'our', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'with', 'what', 'how', 'where', 'when', 'who', 'which', 'can', 'i', 'it', 'be', 'that', 'this', 'have', 'has', 'any', 'about', 'there', 'their', 'they', 'from', 'by', 'at', 'as', 'was', 'were', 'will', 'my']);

export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function buildSources(snapshot: Snapshot): ChatSource[] {
  const sources: ChatSource[] = [];
  sources.push({ id: 'profile', kind: 'profile', title: `${snapshot.site.companyName} security overview`, text: `${snapshot.site.headline}. ${snapshot.site.summary} Data location: ${snapshot.site.location}. Security contact: ${snapshot.site.securityEmail}.` });
  for (const faq of snapshot.faqs) sources.push({ id: `faq:${faq.id}`, kind: 'faq', title: faq.question, text: faq.answer });
  for (const category of snapshot.controlCategories) {
    for (const control of category.controls) {
      const status = 'status' in control && control.status ? ` Status: ${control.status}.` : '';
      sources.push({ id: `control:${control.id}`, kind: 'control', title: control.name, text: `${category.name} control. ${control.description}${status}` });
    }
  }
  for (const document of snapshot.documents) {
    const access = document.visibility === 'request' ? 'Available on request after review.' : 'Publicly available.';
    sources.push({ id: `document:${document.id}`, kind: 'document', title: document.title, text: `${document.description} ${access} Category: ${document.category}.` });
  }
  for (const subprocessor of snapshot.subprocessors) {
    sources.push({ id: `subprocessor:${subprocessor.id}`, kind: 'subprocessor', title: subprocessor.name, text: `Subprocessor. ${subprocessor.purpose} ${subprocessor.description} Location: ${subprocessor.location}.` });
  }
  for (const certification of snapshot.certifications) {
    sources.push({ id: `certification:${certification.id}`, kind: 'certification', title: certification.name, text: `Compliance framework, status ${certification.status}. ${certification.description}` });
  }
  if (snapshot.dataCollected.items.length) {
    const collected = snapshot.dataCollected.items.filter((item) => item.status === 'COLLECTED').map((item) => item.dataCollected);
    const notCollected = snapshot.dataCollected.items.filter((item) => item.status === 'NOT_COLLECTED').map((item) => item.dataCollected);
    sources.push({ id: 'data-collected', kind: 'data', title: snapshot.dataCollected.heading || 'Data collected', text: `Collected: ${collected.join(', ') || 'none listed'}. Not collected: ${notCollected.join(', ') || 'none listed'}.` });
  }
  for (const update of snapshot.updates.slice(0, 10)) {
    sources.push({ id: `update:${update.id}`, kind: 'update', title: update.title, text: `${update.category} update on ${update.publishedAt.slice(0, 10)}. ${update.body}` });
  }
  return sources;
}

export function rankSources(question: string, sources: ChatSource[], limit = 4): ChatSource[] {
  const tokens = tokenize(question);
  if (!tokens.length) return [];
  return sources
    .map((source) => {
      const titleTokens = new Set(tokenize(source.title));
      const bodyTokens = new Set(tokenize(source.text));
      let score = 0;
      for (const token of tokens) {
        if (titleTokens.has(token)) score += 3;
        if (bodyTokens.has(token)) score += 1;
        for (const candidate of titleTokens) if (candidate.startsWith(token) || token.startsWith(candidate)) score += 0.5;
      }
      if (source.kind === 'faq') score *= 1.25;
      return { source, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.source);
}

function retrievalReply(question: string, matches: ChatSource[], companyName: string, contact: string): string {
  if (!matches.length) {
    return `I could not find a published answer to that in the ${companyName} trust center. Contact ${contact} and the security team will follow up.`;
  }
  const [best, ...rest] = matches;
  const lines: string[] = [];
  if (best!.kind === 'faq') lines.push(best!.text);
  else lines.push(`${best!.title}: ${best!.text}`.trim());
  if (rest.length) {
    lines.push('', 'Related published items:');
    for (const source of rest) lines.push(`- ${source.title}`);
  }
  lines.push('', 'This answer only uses content published on this trust center.');
  return lines.join('\n');
}

export async function answerQuestion(input: {
  question: string;
  history: Array<{ role: 'USER' | 'ASSISTANT'; message: string }>;
  snapshot: Snapshot;
  ai?: AiBinding;
}): Promise<ChatAnswer> {
  const sources = buildSources(input.snapshot);
  const matches = rankSources(input.question, sources);
  const references = matches.map((source) => source.id);
  const companyName = input.snapshot.site.companyName;
  const contact = input.snapshot.site.securityEmail;
  if (!input.ai || !matches.length) {
    return { reply: retrievalReply(input.question, matches, companyName, contact), references, mode: 'retrieval' };
  }
  const context = matches.map((source, index) => `[${index + 1}] ${source.title}\n${source.text}`).join('\n\n');
  const system = [
    `You are the trust center assistant for ${companyName}.`,
    'Answer only from the published context below. If the context does not answer the question, say so and point the visitor to the security contact.',
    'Never invent certifications, customers, controls, or commitments. Keep answers under 120 words. Plain text, no markdown headings.',
    `Security contact: ${contact}.`,
    '',
    'Published context:',
    context
  ].join('\n');
  const messages = [
    { role: 'system', content: system },
    ...input.history.slice(-6).map((entry) => ({ role: entry.role === 'USER' ? 'user' : 'assistant', content: entry.message })),
    { role: 'user', content: input.question }
  ];
  try {
    const result = await input.ai.run(CHAT_MODEL, { messages, max_tokens: 320 }) as { response?: string } | string;
    const reply = typeof result === 'string' ? result : result?.response ?? '';
    if (!reply.trim()) throw new Error('empty response');
    return { reply: reply.trim(), references, mode: 'ai' };
  } catch {
    return { reply: retrievalReply(input.question, matches, companyName, contact), references, mode: 'retrieval' };
  }
}
