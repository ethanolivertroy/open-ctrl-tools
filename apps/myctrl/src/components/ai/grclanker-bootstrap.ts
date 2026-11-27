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

function getChatContext() {
  const root = document.getElementById('myctrl-grclanker-root');
  return {
    frameworkId: root?.dataset.frameworkId || undefined,
    controlSlug: root?.dataset.controlSlug || undefined,
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
  const newThreadAttr = trigger.getAttribute('data-ai-new-thread');
  const newThread = newThreadAttr ? newThreadAttr !== 'false' : undefined;

  if (!prompt && !frameworkId && !controlSlug && newThread === undefined) {
    return undefined;
  }

  return { prompt, frameworkId, controlSlug, newThread };
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
