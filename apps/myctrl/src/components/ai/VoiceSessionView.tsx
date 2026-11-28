import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  getDefaultVoice,
  VOICE_PRESETS,
  type VoiceMode,
  type VoiceProviderId,
} from '@/lib/voice/protocol';
import {
  selectPreferredVoiceProvider,
  startVoiceSession,
} from '@/lib/voice/session-manager';
import type {
  ActiveVoiceTransport,
  VoiceConnectionState,
  VoiceTranscriptEntry,
} from '@/lib/voice/types';
import { isBrowserSpeechSupported } from '@/lib/voice/browser-speech';
import { getEnabledProviders } from '@/lib/storage/provider-store';
import { Mic, MicOff, PhoneOff, Radio, Send, Settings, Square } from 'lucide-react';

interface VoiceSessionViewProps {
  frameworkId?: string;
  controlSlug?: string;
  controlTitle?: string;
  assessmentQuestions?: string[];
  requestedMode?: VoiceMode;
  onOpenSettings: () => void;
}

const STATE_LABEL: Record<VoiceConnectionState, string> = {
  idle: 'Ready',
  connecting: 'Connecting...',
  listening: 'Listening',
  thinking: 'Thinking / Calling Tools',
  speaking: 'Speaking',
  error: 'Error',
};

const PROVIDER_OPTIONS: { id: VoiceProviderId; label: string; badge: string }[] = [
  { id: 'openai', label: 'OpenAI Realtime', badge: 'WebRTC' },
  { id: 'grok', label: 'xAI Grok Voice', badge: 'WS PCM' },
  { id: 'gemini', label: 'Gemini Live', badge: 'WS Native' },
  { id: 'browser', label: 'Browser Speech', badge: 'Free' },
];

export function VoiceSessionView({
  frameworkId,
  controlSlug,
  controlTitle,
  assessmentQuestions,
  requestedMode,
  onOpenSettings,
}: VoiceSessionViewProps) {
  const [provider, setProvider] = React.useState<VoiceProviderId>('openai');
  const [configuredRealtime, setConfiguredRealtime] = React.useState<Set<VoiceProviderId>>(new Set());
  const [mode, setMode] = React.useState<VoiceMode>(requestedMode || 'copilot');
  const [voice, setVoice] = React.useState<string>('marin');
  const [connState, setConnState] = React.useState<VoiceConnectionState>('idle');
  const [muted, setMuted] = React.useState(false);
  const [inputLevel, setInputLevel] = React.useState(0);
  const [outputLevel, setOutputLevel] = React.useState(0);
  const [activeTool, setActiveTool] = React.useState<string | null>(null);
  const [transcripts, setTranscripts] = React.useState<VoiceTranscriptEntry[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [textTurn, setTextTurn] = React.useState('');

  const transportRef = React.useRef<ActiveVoiceTransport | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (requestedMode) {
      setMode(requestedMode);
    }
  }, [requestedMode]);

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      const [preferred, enabled] = await Promise.all([
        selectPreferredVoiceProvider(),
        getEnabledProviders(),
      ]);
      if (!alive) return;
      const set = new Set<VoiceProviderId>();
      for (const cfg of enabled) {
        if (cfg.apiKey || cfg.oauth?.refreshToken) {
          if (cfg.providerId === 'openai' || cfg.providerId === 'grok' || cfg.providerId === 'gemini') {
            set.add(cfg.providerId);
          }
        }
      }
      if (isBrowserSpeechSupported()) set.add('browser');
      setConfiguredRealtime(set);
      setProvider(preferred);
      setVoice(getDefaultVoice(preferred));
    })();
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    setVoice(getDefaultVoice(provider));
  }, [provider]);

  React.useEffect(() => {
    return () => {
      void transportRef.current?.stop();
      transportRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  const upsertTranscript = React.useCallback((entry: VoiceTranscriptEntry) => {
    setTranscripts((prev) => {
      const idx = prev.findIndex((item) => item.id === entry.id);
      if (idx === -1) return [...prev.slice(-40), entry];
      const next = [...prev];
      next[idx] = entry;
      return next;
    });
  }, []);

  const handleStart = async () => {
    setError(null);
    setActiveTool(null);
    setMuted(false);

    try {
      const transport = await startVoiceSession({
        provider,
        mode,
        voice,
        frameworkId,
        controlSlug,
        controlTitle,
        assessmentQuestions,
        onStateChange: setConnState,
        onTranscript: upsertTranscript,
        onToolActivity: (toolName) => setActiveTool(toolName),
        onInputLevel: setInputLevel,
        onOutputLevel: setOutputLevel,
        onError: (msg) => {
          setError(msg);
          setConnState('error');
        },
      });
      transportRef.current = transport;
    } catch (err) {
      setConnState('error');
      setError(err instanceof Error ? err.message : 'Unable to start voice session.');
    }
  };

  const handleStop = async () => {
    if (transportRef.current) {
      await transportRef.current.stop();
      transportRef.current = null;
    }
    setActiveTool(null);
    setInputLevel(0);
    setOutputLevel(0);
    setConnState('idle');
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    transportRef.current?.setMuted(next);
  };

  const handleInterrupt = () => {
    transportRef.current?.interrupt();
  };

  const handleSendTextTurn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textTurn.trim() || !transportRef.current?.sendTextTurn) return;
    transportRef.current.sendTextTurn(textTurn);
    setTextTurn('');
  };

  const isActive = connState !== 'idle' && connState !== 'error';
  const voiceList = provider === 'browser' ? [] : VOICE_PRESETS[provider];
  const combinedLevel = Math.max(inputLevel, outputLevel);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mode & Provider Configuration */}
      <div className="space-y-3 border-b border-border/70 p-3 bg-muted/20 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex rounded-md border border-border bg-background p-0.5 text-xs">
            <button
              type="button"
              disabled={isActive}
              onClick={() => setMode('copilot')}
              className={`px-2.5 py-1 rounded-sm transition-colors ${
                mode === 'copilot'
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Copilot
            </button>
            <button
              type="button"
              disabled={isActive}
              onClick={() => setMode('audit-interview')}
              className={`px-2.5 py-1 rounded-sm transition-colors ${
                mode === 'audit-interview'
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mock Audit Interview
            </button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenSettings}
            className="h-7 px-2 text-xs gap-1"
            title="Configure OpenAI, xAI Grok, or Gemini keys"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Keys</span>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="voice-provider-select" className="block text-[11px] font-mono text-muted-foreground mb-1">
              Voice Engine
            </label>
            <select
              id="voice-provider-select"
              value={provider}
              disabled={isActive}
              onChange={(e) => setProvider(e.target.value as VoiceProviderId)}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
            >
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label} ({opt.badge})
                  {configuredRealtime.has(opt.id) ? ' · Ready' : ''}
                </option>
              ))}
            </select>
          </div>

          {voiceList.length > 0 ? (
            <div>
              <label htmlFor="voice-preset-select" className="block text-[11px] font-mono text-muted-foreground mb-1">
                Voice
              </label>
              <select
                id="voice-preset-select"
                value={voice}
                disabled={isActive}
                onChange={(e) => setVoice(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs font-mono"
              >
                {voiceList.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-end">
              <span className="text-[11px] text-muted-foreground font-mono pb-1.5">
                Web Speech + Chat LLM
              </span>
            </div>
          )}
        </div>

        {/* Status & Waveform Visualizer */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/80 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Radio
              className={`h-3.5 w-3.5 shrink-0 ${
                connState === 'listening'
                  ? 'text-green-500 animate-pulse'
                  : connState === 'speaking'
                    ? 'text-primary animate-pulse'
                    : connState === 'thinking'
                      ? 'text-yellow-500 animate-pulse'
                      : connState === 'error'
                        ? 'text-destructive'
                        : 'text-muted-foreground'
              }`}
            />
            <span className="text-xs font-mono truncate">
              {STATE_LABEL[connState]}
              {activeTool && connState === 'thinking' ? ` (${activeTool})` : ''}
            </span>
          </div>

          {/* Live reactive audio level bars */}
          <div className="flex items-center gap-1 h-4" aria-hidden="true">
            {[0.35, 0.7, 1, 0.75, 0.45].map((scale, idx) => {
              const barH = Math.max(20, Math.round(combinedLevel * scale * 100));
              return (
                <span
                  key={idx}
                  className="w-1 rounded-full bg-primary transition-all duration-75"
                  style={{ height: `${Math.min(100, barH)}%`, opacity: isActive ? 0.9 : 0.25 }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Live Transcripts */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2.5">
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {transcripts.length === 0 ? (
          <div className="py-8 px-3 text-center space-y-2">
            <p className="text-sm font-medium text-foreground">
              {mode === 'audit-interview' ? 'Mock Audit Interview Ready' : 'GRCLanker Live Voice'}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {controlTitle
                ? `Scoped to ${controlTitle} (${frameworkId}). `
                : frameworkId
                  ? `Scoped to framework ${frameworkId}. `
                  : ''}
              Press Start Voice Session to talk full-duplex with control lookup and UI inspection tools.
            </p>
          </div>
        ) : (
          transcripts.map((entry) => (
            <div
              key={entry.id}
              className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
                entry.role === 'user'
                  ? 'bg-primary/10 text-foreground ml-6'
                  : 'bg-muted/60 text-foreground mr-6'
              } ${entry.final ? '' : 'opacity-75 italic'}`}
            >
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                {entry.role === 'user' ? 'You' : 'GRCLanker'}
              </div>
              <div>{entry.text}</div>
            </div>
          ))
        )}
      </div>

      {/* Transport Controls & Text Turn Fallback */}
      <div className="border-t border-border p-3 space-y-2.5 shrink-0 bg-card">
        {isActive && (
          <form onSubmit={handleSendTextTurn} className="flex items-center gap-2">
            <input
              type="text"
              value={textTurn}
              onChange={(e) => setTextTurn(e.target.value)}
              placeholder="Send typed note into live voice session..."
              className="flex-1 h-8 rounded-md border border-input bg-background px-2.5 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
            <Button type="submit" size="sm" variant="secondary" className="h-8 px-2.5" disabled={!textTurn.trim()}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        )}

        <div className="flex items-center gap-2">
          {!isActive ? (
            <Button
              type="button"
              onClick={() => void handleStart()}
              className="flex-1 gap-2"
            >
              <Mic className="h-4 w-4" />
              <span>Start Voice Session</span>
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant={muted ? 'secondary' : 'outline'}
                onClick={handleToggleMute}
                className="flex-1 gap-1.5"
              >
                {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                <span>{muted ? 'Unmute' : 'Mute'}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleInterrupt}
                disabled={connState !== 'speaking'}
                title="Interrupt assistant speech"
                className="gap-1.5"
              >
                <Square className="h-3.5 w-3.5" />
                <span>Interrupt</span>
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleStop()}
                className="gap-1.5"
              >
                <PhoneOff className="h-4 w-4" />
                <span>End</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
