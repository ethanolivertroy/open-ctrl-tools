/**
 * TrustCenterComponents — Shows suggested trust center components for a FedRAMP 20x KSI.
 *
 * Renders as a teal-accented card section with category badges
 * and collapsible example lists for each suggested trust center component.
 */

import * as React from 'react';
import { useState } from 'react';
import { ChevronRightIcon, ShieldCheckIcon, LightbulbIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TrustCenterComponent, TrustCenterCategory } from '@/data/types';
import { getCategoryMeta } from '@/data/ksi-trust-center-components';

// Category color mapping (Tailwind classes)
const CATEGORY_COLORS: Record<TrustCenterCategory, string> = {
  'documents-reports': 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30',
  'policies': 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
  'certifications-badges': 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  'architecture-diagrams': 'bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30',
  'dashboards': 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-500/30',
  'product-security-features': 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30',
  'evidence-artifacts': 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30',
  'questionnaire-responses': 'bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30',
  'vendor-supply-chain': 'bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30',
  'processes-procedures': 'bg-slate-500/20 text-slate-700 dark:text-slate-400 border-slate-500/30',
};

interface TrustCenterComponentsProps {
  components: TrustCenterComponent[];
  implementationInsight?: string;
}

function TrustCenterComponentCard({ component }: { component: TrustCenterComponent }) {
  const [showExamples, setShowExamples] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const meta = getCategoryMeta(component.category);
  const colorClass = CATEGORY_COLORS[component.category] || '';

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="space-y-1 min-w-0">
          <h4 className="text-sm font-semibold leading-tight">{component.name}</h4>
          <Badge variant="secondary" className={`text-xs ${colorClass}`}>
            {meta?.name || component.category}
          </Badge>
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">
        {component.description}
      </p>

      {component.validationHint && (
        <div className="flex items-start gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <ShieldCheckIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{component.validationHint}</span>
        </div>
      )}

      {component.examples && component.examples.length > 0 && (
        <div>
          <button
            onClick={() => setShowExamples(!showExamples)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRightIcon
              className={`w-3 h-3 transition-transform ${showExamples ? 'rotate-90' : ''}`}
            />
            <span>Examples ({component.examples.length})</span>
          </button>
          {showExamples && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {component.examples.map((ex, i) => (
                <span
                  key={i}
                  className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                >
                  {ex}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {component.evidenceExamples && component.evidenceExamples.length > 0 && (
        <div>
          <button
            onClick={() => setShowEvidence(!showEvidence)}
            className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"
          >
            <ChevronRightIcon
              className={`w-3 h-3 transition-transform ${showEvidence ? 'rotate-90' : ''}`}
            />
            <span>Evidence Artifacts ({component.evidenceExamples.length})</span>
          </button>
          {showEvidence && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {component.evidenceExamples.map((ev, i) => (
                <span
                  key={i}
                  className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                >
                  {ev}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TrustCenterComponents({ components, implementationInsight }: TrustCenterComponentsProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <span className="text-primary font-mono">{'>'}</span>
        Trust Center Components
        <Badge variant="outline" className="text-xs font-normal">
          {components.length}
        </Badge>
      </h2>
      <p className="text-sm text-muted-foreground">
        Ways to express your implementation of this indicator — approaches vary by organization size, complexity, and data sensitivity.
      </p>
      {implementationInsight && (
        <div className="flex gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <LightbulbIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
            <span className="font-medium">From the field: </span>
            {implementationInsight}
          </p>
        </div>
      )}
      <Card className="bg-muted/50 border-border">
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {components.map((component, i) => (
              <TrustCenterComponentCard key={i} component={component} />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
