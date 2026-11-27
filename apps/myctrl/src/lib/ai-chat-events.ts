/**
 * Single owner of the GRCLanker open-chat / open-settings handshake.
 *
 * A request is recorded on `window` *before* the event dispatch so that the
 * lazily-mounted dock can consume it after loading, even when no listener was
 * attached at dispatch time. No other module may touch these globals or
 * dispatch these events directly — always go through `requestOpenAIChat` /
 * `requestOpenAISettings`.
 */

export const OPEN_AI_CHAT_EVENT = 'open-ai-chat';
export const OPEN_AI_SETTINGS_EVENT = 'open-ai-settings';

export interface OpenAIChatDetail {
  prompt?: string;
  frameworkId?: string;
  controlSlug?: string;
  newThread?: boolean;
}

declare global {
  interface Window {
    __myctrlPendingAISettings?: boolean;
    __myctrlPendingAIChat?: OpenAIChatDetail | true;
  }
}

export function requestOpenAIChat(detail?: OpenAIChatDetail): void {
  window.__myctrlPendingAIChat = detail ?? true;
  document.dispatchEvent(new CustomEvent<OpenAIChatDetail | undefined>(OPEN_AI_CHAT_EVENT, { detail }));
}

export function requestOpenAISettings(): void {
  window.__myctrlPendingAISettings = true;
  document.dispatchEvent(new CustomEvent(OPEN_AI_SETTINGS_EVENT));
}

export function hasPendingAIChatRequest(): boolean {
  return window.__myctrlPendingAIChat !== undefined;
}

export function hasPendingAISettingsRequest(): boolean {
  return Boolean(window.__myctrlPendingAISettings);
}

export function consumePendingAIChatRequest(): OpenAIChatDetail | true | undefined {
  const pending = window.__myctrlPendingAIChat;
  delete window.__myctrlPendingAIChat;
  return pending;
}

export function consumePendingAISettingsRequest(): boolean {
  const pending = Boolean(window.__myctrlPendingAISettings);
  delete window.__myctrlPendingAISettings;
  return pending;
}
