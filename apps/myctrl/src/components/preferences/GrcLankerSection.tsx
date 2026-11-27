import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  getAgentThreadMode,
  setAgentThreadMode,
  getAllAgentConversations,
  clearAllAgentConversations,
  exportAgentConversationsAsMarkdown,
} from '@/lib/storage/agent-store';
import type { AgentThreadMode } from '@/lib/db';

const THREAD_OPTIONS: { value: AgentThreadMode; label: string; description: string }[] = [
  {
    value: 'per-session',
    label: 'Per session (default)',
    description: 'One conversation thread per control. Follow-up questions build on prior context.',
  },
  {
    value: 'per-action',
    label: 'Per action',
    description: 'Each quick action or question starts a fresh conversation. Cleaner history, no context carryover.',
  },
];

export function GrcLankerSection() {
  const [threadMode, setThreadModeState] = useState<AgentThreadMode>('per-session');
  const [conversationCount, setConversationCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    getAgentThreadMode().then(setThreadModeState);
    getAllAgentConversations().then(c => setConversationCount(c.length));
  }, []);

  const handleModeChange = (mode: AgentThreadMode) => {
    setThreadModeState(mode);
    setAgentThreadMode(mode);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const md = await exportAgentConversationsAsMarkdown();
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grclanker-conversations-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Delete all saved GRCLanker conversations? This cannot be undone.')) return;
    setIsClearing(true);
    try {
      await clearAllAgentConversations();
      setConversationCount(0);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <section id="grc-agent" className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="text-primary">{'>'}</span> GRCLanker
      </h2>
      <p className="text-sm text-muted-foreground">
        Configure how the AI assistant saves and organizes conversations during gap analysis.
      </p>

      {/* Thread mode */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Conversation threading</p>
        {THREAD_OPTIONS.map(opt => (
          <label
            key={opt.value}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              threadMode === opt.value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/30'
            }`}
          >
            <input
              type="radio"
              name="thread-mode"
              value={opt.value}
              checked={threadMode === opt.value}
              onChange={() => handleModeChange(opt.value)}
              className="mt-1 accent-[var(--color-primary)]"
            />
            <div>
              <p className="text-sm font-medium">{opt.label}</p>
              <p className="text-xs text-muted-foreground">{opt.description}</p>
            </div>
          </label>
        ))}
      </div>

      {/* Conversation data */}
      <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-3">
        <p className="text-xs font-medium text-muted-foreground">
          Saved conversations: {conversationCount}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={conversationCount === 0 || isExporting}
            className="text-xs"
          >
            {isExporting ? 'Exporting...' : 'Export as Markdown'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleClear}
            disabled={conversationCount === 0 || isClearing}
            className="text-xs text-destructive hover:text-destructive"
          >
            {isClearing ? 'Clearing...' : 'Clear All'}
          </Button>
        </div>
      </div>
    </section>
  );
}
