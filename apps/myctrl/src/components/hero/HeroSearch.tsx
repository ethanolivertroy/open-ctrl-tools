import * as React from 'react';
import { requestOpenAIChat } from '@/lib/ai-chat-events';
import { Mic, Search } from 'lucide-react';

export function HeroSearch() {
  const openSearchPalette = () => {
    document.dispatchEvent(new CustomEvent('open-search'));
  };

  const openVoiceCopilot = () => {
    requestOpenAIChat({
      tab: 'voice',
      voiceMode: 'copilot',
    });
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full max-w-2xl">
      <button
        type="button"
        onClick={openSearchPalette}
        className="flex-1 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-card/85 backdrop-blur-md border border-border/70 hover:border-primary/50 text-left transition-all group shadow-sm"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Search className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors truncate">
            Search controls (AC-2, 1.1.1, MFA) or run{' '}
            <code className="font-mono text-xs text-primary/90">&gt;</code> commands...
          </span>
        </div>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono bg-muted/70 text-muted-foreground rounded border border-border/70 shrink-0">
          <span>⌘K</span>
        </kbd>
      </button>

      <button
        type="button"
        onClick={openVoiceCopilot}
        className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-primary/35 bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors shrink-0"
        title="Talk to GRCLanker Voice (BYOK Realtime or Browser Speech)"
      >
        <Mic className="w-4 h-4" />
        <span>Ask Voice</span>
      </button>
    </div>
  );
}
