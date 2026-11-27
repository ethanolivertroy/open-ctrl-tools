import { useState } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { CodeBlock } from '@/components/ui/CodeBlock';
import type { ConfigExample, KubernetesGuidance } from '@/data/types';

// Helper component for guidance sections
export function GuidanceSection({ title, content }: { title: string; content?: string }) {
  if (!content) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-primary/80">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
        {content}
      </p>
    </div>
  );
}

// Helper component for collapsible code examples
export function CollapsibleCodeExamples({ examples }: { examples: ConfigExample[] }) {
  const [expandedExamples, setExpandedExamples] = useState<Set<number>>(new Set([0])); // First expanded by default

  const toggleExample = (index: number) => {
    setExpandedExamples((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {examples.map((example, index) => (
        <div key={index} className="rounded-md border border-border overflow-hidden">
          <button
            onClick={() => toggleExample(index)}
            aria-expanded={expandedExamples.has(index)}
            aria-label={`Toggle ${example.title} example`}
            className="w-full flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted transition-colors text-left"
          >
            <ChevronRightIcon className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${expandedExamples.has(index) ? 'rotate-90' : ''}`} />
            <span className="text-sm text-foreground flex-1 truncate">{example.title}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-background text-muted-foreground border border-border">
              {example.language.toUpperCase()}
            </span>
          </button>
          {expandedExamples.has(index) && (
            <div className="relative">
              {example.discussion && (
                <div className="px-3 py-2 bg-primary/5 border-b border-border">
                  <p className="text-xs text-foreground/80 leading-relaxed italic">
                    {example.discussion}
                  </p>
                </div>
              )}
              <CodeBlock code={example.code} language={example.language} />
              {example.source && (
                <div className="px-3 py-2 border-t border-border bg-muted/30">
                  <span className="text-xs text-muted-foreground">Source: {example.source}</span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Helper component for Kubernetes guidance with narrative and examples
export function KubernetesGuidanceSection({ guidance }: { guidance: KubernetesGuidance }) {
  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground/80">What This Control Means in Practice</h3>
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {guidance.overview}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Attribute Examples */}
      {guidance.attribute_examples && guidance.attribute_examples.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground/80">Common Attributes</h3>
          <Card className="bg-muted/30 border-border">
            <CardContent>
              <ul className="space-y-2">
                {guidance.attribute_examples.map((attr, i) => (
                  <li key={i} className="text-sm text-muted-foreground leading-relaxed flex gap-2">
                    <span className="text-primary shrink-0">•</span>
                    <span>{attr}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Implementation Examples */}
      {guidance.examples && guidance.examples.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground/80">Implementation Examples</h3>
          <CollapsibleCodeExamples examples={guidance.examples} />
        </div>
      )}

      {/* Validation */}
      {guidance.validation && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground/80">How to Validate</h3>
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardContent>
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {guidance.validation}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Legacy helper for raw kubernetes examples (backwards compatibility)
export function KubernetesExamplesSection({ examples }: { examples: ConfigExample[] }) {
  return <CollapsibleCodeExamples examples={examples} />;
}

// Parse formatted FedRAMP parameters "(h) (1): value" into grouped structure
export interface ParameterItem {
  number?: string;
  value: string;
}

export interface ParameterGroup {
  letter: string;
  items: ParameterItem[];
}

export function parseFormattedParameters(text: string): ParameterGroup[] {
  const lines = text.split('\n');
  const groups: Map<string, ParameterItem[]> = new Map();

  for (const line of lines) {
    // Match patterns like "(h) (1): value" or "(j): value"
    const match = line.match(/^\(([a-z])\)(?:\s*\((\d+)\))?\s*:\s*(.+)$/);
    if (match) {
      const letter = match[1];
      const number = match[2] || undefined;
      const value = match[3].trim();

      if (!groups.has(letter)) {
        groups.set(letter, []);
      }
      groups.get(letter)!.push({ number, value });
    }
  }

  // Convert to array, sorted by letter
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, items]) => ({ letter, items }));
}
