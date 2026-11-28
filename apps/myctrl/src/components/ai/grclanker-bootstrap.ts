import {
  OPEN_AI_CHAT_EVENT,
  OPEN_AI_SETTINGS_EVENT,
  requestOpenAIChat,
  requestOpenAISettings,
  type OpenAIChatDetail,
} from '@/lib/ai-chat-events';

declare global {
  interface Window {
    __myctrlAIChatBootstrap?: boolean;
  }
}

let mountPromise: Promise<typeof import('./grclanker-mount')> | null = null;

function parseQuestionsAttr(raw: string | undefined | null): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((q): q is string => typeof q === 'string')
      : undefined;
  } catch {
    return undefined;
  }
}

function getChatContext() {
  const root = document.getElementById('myctrl-grclanker-root');
  return {
    frameworkId: root?.dataset.frameworkId || undefined,
    controlSlug: root?.dataset.controlSlug || undefined,
    controlTitle: root?.dataset.controlTitle || undefined,
    assessmentQuestions: parseQuestionsAttr(root?.dataset.assessmentQuestions),
  };
}

function loadMount() {
  if (!mountPromise) {
    mountPromise = import('./grclanker-mount').catch((error) => {
      mountPromise = null;
      console.error('GRCLanker failed to load:', error);
      throw error;
    });
  }
  return mountPromise;
}

function mountChat() {
  void loadMount().then(({ mountGrcLankerDock }) => {
    mountGrcLankerDock(getChatContext());
  });
}

function getChatTriggerDetail(trigger: Element): OpenAIChatDetail | undefined {
  const prompt = trigger.getAttribute('data-ai-chat-prompt') || undefined;
  const frameworkId = trigger.getAttribute('data-ai-framework-id') || undefined;
  const controlSlug = trigger.getAttribute('data-ai-control-slug') || undefined;
  const controlTitle = trigger.getAttribute('data-ai-control-title') || undefined;
  const tabAttr = trigger.getAttribute('data-ai-tab');
  const voiceModeAttr = trigger.getAttribute('data-ai-voice-mode');
  const newThreadAttr = trigger.getAttribute('data-ai-new-thread');
  const newThread = newThreadAttr ? newThreadAttr !== 'false' : undefined;
  const assessmentQuestions = parseQuestionsAttr(
    trigger.getAttribute('data-ai-assessment-questions'),
  );

  const tab = tabAttr === 'chat' || tabAttr === 'voice' ? tabAttr : undefined;
  const voiceMode =
    voiceModeAttr === 'copilot' || voiceModeAttr === 'audit-interview'
      ? voiceModeAttr
      : undefined;

  if (
    !prompt &&
    !frameworkId &&
    !controlSlug &&
    !controlTitle &&
    !tab &&
    !voiceMode &&
    !assessmentQuestions &&
    newThread === undefined
  ) {
    return undefined;
  }

  return {
    prompt,
    frameworkId,
    controlSlug,
    controlTitle,
    tab,
    voiceMode,
    assessmentQuestions,
    newThread,
  };
}

export function registerGrcLankerBootstrap() {
  if (window.__myctrlAIChatBootstrap) return;
  window.__myctrlAIChatBootstrap = true;

  // Requests record their pending flag before dispatch (see ai-chat-events),
  // so these listeners only need to make sure the React tree is mounted.
  document.addEventListener(OPEN_AI_SETTINGS_EVENT, mountChat);
  document.addEventListener(OPEN_AI_CHAT_EVENT, mountChat);

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const settingsTrigger = target.closest('[data-ai-settings-trigger]');
      if (settingsTrigger) {
        event.preventDefault();
        requestOpenAISettings();
        return;
      }

      const chatTrigger = target.closest('[data-ai-chat-trigger]');
      if (!chatTrigger) return;

      event.preventDefault();
      requestOpenAIChat(getChatTriggerDetail(chatTrigger));
    },
    true,
  );

  document.addEventListener(
    'pointerenter',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest('[data-ai-chat-trigger],[data-ai-settings-trigger]')) return;
      void loadMount();
    },
    true,
  );

  const idle = window.requestIdleCallback || ((cb: () => void) => window.setTimeout(cb, 2500));
  idle(() => {
    void loadMount();
  });
}
