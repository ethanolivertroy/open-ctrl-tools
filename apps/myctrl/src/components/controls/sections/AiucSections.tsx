import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AIUCControl } from '@/data/types';
import { SectionHeading } from './ControlSection';

// AIUC-1 Application, Frequency, Capabilities & Evidence
export function AiucSections({ control }: { control: AIUCControl }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center">
        {/* Application Badge */}
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-muted-foreground">Application</h2>
          <Badge
            variant={control.application === 'Mandatory' ? 'default' : 'secondary'}
            className={`text-sm ${control.application === 'Mandatory' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
          >
            {control.application}
          </Badge>
        </div>

        {/* Frequency */}
        {control.frequency && (
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-muted-foreground">Frequency</h2>
            <span className="text-sm">{control.frequency}</span>
          </div>
        )}

        {/* Capabilities */}
        {control.capabilities && (
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-muted-foreground">Capabilities</h2>
            <Badge variant="outline" className="text-sm font-normal">
              {control.capabilities}
            </Badge>
          </div>
        )}
      </div>

      {/* Controls & Evidence */}
      {control.controls_evidence && control.controls_evidence.length > 0 && (
        <div className="space-y-3">
          <SectionHeading>Controls & Evidence ({control.controls_evidence.length})</SectionHeading>
          {/* Group by category */}
          {(() => {
            const categories = new Map<string, typeof control.controls_evidence>();
            for (const ev of control.controls_evidence) {
              const cat = ev.category || 'Other';
              if (!categories.has(cat)) categories.set(cat, []);
              categories.get(cat)!.push(ev);
            }
            return Array.from(categories.entries()).map(([category, items]) => (
              <div key={category} className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {category}
                </h3>
                {items.map((ev) => (
                  <Card key={ev.evidence_id} className="bg-muted/50 border-border">
                    <CardContent className="space-y-2 py-3">
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="text-[11px] px-1.5 py-0 shrink-0 font-mono">
                          {ev.evidence_id}
                        </Badge>
                        <span className="text-sm font-medium">{ev.evidence_title.replace(/^[A-F]\d{3}\.\d+\s*/, '')}</span>
                      </div>
                      {ev.control_application && (
                        <p className="text-xs text-primary/80 font-medium">{ev.control_application}</p>
                      )}
                      {ev.control_text && (
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{ev.control_text}</p>
                      )}
                      {ev.typical_evidence && (
                        <div className="text-xs text-muted-foreground/80 border-t border-border pt-2 mt-2">
                          <span className="font-semibold">Typical evidence:</span> {ev.typical_evidence}
                        </div>
                      )}
                      {ev.location && (
                        <div className="text-xs text-muted-foreground/80">
                          <span className="font-semibold">Location:</span> {ev.location}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ));
          })()}
        </div>
      )}
    </section>
  );
}
