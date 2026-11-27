import { useState, useEffect } from 'react';
import {
  getAIDataPreference,
  setAIDataPreference,
  getAIDataSummary,
  type AIDataPreference,
} from '@/lib/ai-data-context';

const OPTIONS: { value: AIDataPreference; label: string; description: string }[] = [
  { value: 'always', label: 'Always include', description: 'Automatically share your context with AI for better responses.' },
  { value: 'ask', label: 'Ask each time', description: 'Prompt before including your data in AI requests.' },
  { value: 'never', label: 'Never include', description: 'AI features work without any personal context.' },
];

export function AiDataSection() {
  const [preference, setPreference] = useState<AIDataPreference | null>(null);
  const [summary, setSummary] = useState<string[]>([]);

  useEffect(() => {
    getAIDataPreference().then(pref => setPreference(pref ?? 'ask'));
    getAIDataSummary().then(setSummary);
  }, []);

  const handleChange = (value: AIDataPreference) => {
    setPreference(value);
    setAIDataPreference(value);
  };

  return (
    <section id="ai-data" className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="text-primary">{'>'}</span> AI Data Preferences
      </h2>
      <p className="text-sm text-muted-foreground">
        Control what data is shared with the AI assistant for personalized responses.
      </p>

      <div className="space-y-2">
        {OPTIONS.map(opt => (
          <label
            key={opt.value}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              preference === opt.value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/30'
            }`}
          >
            <input
              type="radio"
              name="ai-data-pref"
              value={opt.value}
              checked={preference === opt.value}
              onChange={() => handleChange(opt.value)}
              className="mt-1 accent-[var(--color-primary)]"
            />
            <div>
              <p className="text-sm font-medium">{opt.label}</p>
              <p className="text-xs text-muted-foreground">{opt.description}</p>
            </div>
          </label>
        ))}
      </div>

      {summary.length > 0 && (
        <div className="p-3 rounded-lg border border-border bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground mb-1">Data that would be shared:</p>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {summary.map(item => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
