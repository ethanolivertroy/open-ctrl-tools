import { getDefaultProvider } from '@/lib/storage/provider-store';
import { generateTextWithProvider } from '@/lib/services/ai-text-generation';
import type { ConversationTurn } from '@/lib/ai/conversation';
import { buildVoiceInstructions } from './protocol';
import type { ActiveVoiceTransport, VoiceSessionStartOptions } from './types';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function isBrowserSpeechSupported(): boolean {
  return Boolean(getSpeechRecognitionCtor()) && typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export async function startBrowserSpeechSession(
  options: VoiceSessionStartOptions,
): Promise<ActiveVoiceTransport> {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    throw new Error(
      'Web Speech API speech recognition is not supported in this browser. Connect OpenAI, xAI Grok, or Gemini for WebRTC/WebSocket speech-to-speech.',
    );
  }

  options.onStateChange('connecting');

  let stopped = false;
  let muted = false;
  let processing = false;
  let activeAbort: AbortController | null = null;
  const history: ConversationTurn[] = [];
  const recognition = new Ctor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || 'en-US';

  const systemPrompt = buildVoiceInstructions({
    mode: options.mode,
    frameworkId: options.frameworkId,
    controlSlug: options.controlSlug,
    controlTitle: options.controlTitle,
    assessmentQuestions: options.assessmentQuestions,
  });

  const speakText = (text: string): Promise<void> =>
    new Promise((resolve) => {
      if (stopped || !('speechSynthesis' in window) || !text.trim()) {
        resolve();
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.04;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      options.onStateChange('speaking');
      window.speechSynthesis.speak(utterance);
    });

  const handleTurn = async (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed || stopped || processing) return;

    processing = true;
    options.onStateChange('thinking');

    const userEntryId = `user-${Date.now()}`;
    options.onTranscript({
      id: userEntryId,
      role: 'user',
      text: trimmed,
      final: true,
      timestamp: Date.now(),
    });

    try {
      const provider = (await getDefaultProvider()) || 'anthropic';
      activeAbort = new AbortController();

      const reply = await generateTextWithProvider({
        provider,
        prompt: trimmed,
        systemPrompt,
        context: options.frameworkId
          ? {
              frameworkId: options.frameworkId,
              controlId: options.controlSlug,
            }
          : undefined,
        conversation: history.slice(-8),
        maxOutputTokens: 320,
        signal: activeAbort.signal,
      });

      if (stopped) return;

      history.push({ role: 'user', content: trimmed }, { role: 'assistant', content: reply });
      const cleanSpeech = reply.replace(/[`*_#>-]/g, ' ').replace(/\s+/g, ' ').trim();

      options.onTranscript({
        id: `asst-${Date.now()}`,
        role: 'assistant',
        text: reply,
        final: true,
        timestamp: Date.now(),
      });

      await speakText(cleanSpeech);
    } catch (err) {
      if (!stopped && !(err instanceof DOMException && err.name === 'AbortError')) {
        const message = err instanceof Error ? err.message : 'Browser speech generation failed.';
        options.onError(message);
      }
    } finally {
      activeAbort = null;
      processing = false;
      if (!stopped) {
        options.onStateChange('listening');
      }
    }
  };

  let draftSpeechId = `user-live-${Date.now()}`;

  recognition.onresult = (event) => {
    if (muted || stopped) return;
    let interim = '';
    let finalText = '';

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const res = event.results[i];
      const transcript = res[0]?.transcript || '';
      if (res.isFinal) {
        finalText += transcript;
      } else {
        interim += transcript;
      }
    }

    if (interim.trim()) {
      // User started speaking over assistant audio -> barge in
      if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      options.onInputLevel?.(0.5);
      options.onTranscript({
        id: draftSpeechId,
        role: 'user',
        text: interim.trim(),
        final: false,
        timestamp: Date.now(),
      });
    }

    if (finalText.trim()) {
      draftSpeechId = `user-live-${Date.now()}`;
      options.onInputLevel?.(0);
      void handleTurn(finalText);
    }
  };

  recognition.onerror = (event) => {
    if (stopped) return;
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    if (event.error === 'not-allowed') {
      options.onError('Microphone permission denied.');
    } else if (event.error) {
      options.onError(`Speech recognition error: ${event.error}`);
    }
  };

  recognition.onend = () => {
    if (!stopped && !muted) {
      try {
        recognition.start();
      } catch {
        // Ignore restart race
      }
    }
  };

  recognition.start();
  options.onStateChange('listening');

  if (options.mode === 'audit-interview') {
    const firstPrompt =
      options.assessmentQuestions && options.assessmentQuestions.length > 0
        ? `Let's begin the mock audit interview. ${options.assessmentQuestions[0]}`
        : options.controlTitle
          ? `Let's review ${options.controlTitle}. Walk me through how this control is implemented and verified in your environment.`
          : 'Let us begin the mock audit interview. Which environment or system boundary are we scoping today?';

    options.onTranscript({
      id: `asst-init-${Date.now()}`,
      role: 'assistant',
      text: firstPrompt,
      final: true,
      timestamp: Date.now(),
    });
    void speakText(firstPrompt).then(() => {
      if (!stopped) options.onStateChange('listening');
    });
  }

  return {
    provider: 'browser',
    setMuted: (nextMuted: boolean) => {
      muted = nextMuted;
      if (muted) {
        try {
          recognition.stop();
        } catch {
          // Ignore stop errors
        }
      } else if (!stopped) {
        try {
          recognition.start();
        } catch {
          // Ignore already-running start error
        }
      }
    },
    interrupt: () => {
      activeAbort?.abort();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      options.onStateChange('listening');
    },
    sendTextTurn: (text: string) => {
      void handleTurn(text);
    },
    stop: async () => {
      stopped = true;
      activeAbort?.abort();
      try {
        recognition.abort();
      } catch {
        // Ignore cleanup errors
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      options.onInputLevel?.(0);
      options.onOutputLevel?.(0);
      options.onStateChange('idle');
    },
  };
}
