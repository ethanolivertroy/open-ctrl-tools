import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { FedRAMPControl, FedRAMPBaselineData, GovRAMPControl } from '@/data/types';
import { ControlSection, ProseSection } from './ControlSection';
import { parseFormattedParameters } from './shared';

// FedRAMP Baseline-Specific Data (Tabbed)
export function FedRampBaselineTabs({ control }: { control: FedRAMPControl }) {
  // Check if control is included in any baseline
  const baselines = control.baselines;
  const isIncluded = (data?: FedRAMPBaselineData) => data?.included;

  const inLow = isIncluded(baselines.low);
  const inMod = isIncluded(baselines.moderate);
  const inHigh = isIncluded(baselines.high);

  if (!inLow && !inMod && !inHigh) return null;

  // Determine default tab (highest applicable baseline)
  const defaultTab = inHigh ? 'high' : inMod ? 'moderate' : 'low';

  // Render parameter groups for a baseline
  const renderParameterGroups = (params: string | null | undefined) => {
    if (!params) return null;
    const groups = parseFormattedParameters(params);
    if (groups.length === 0) return null;

    return (
      <div className="space-y-3">
        {groups.map((group) => (
          <div
            key={group.letter}
            className="relative pl-4 border-l-2 border-emerald-500/30 hover:border-emerald-500/60 transition-colors"
          >
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-sm font-mono font-semibold border border-emerald-500/20">
                {group.letter}
              </span>
              <div className="flex-1 min-w-0">
                {group.items.length === 1 && !group.items[0].number ? (
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-normal"
                  >
                    {group.items[0].value}
                  </Badge>
                ) : (
                  <div className="space-y-1.5">
                    {group.items.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="shrink-0 w-5 h-5 flex items-center justify-center text-xs font-mono text-muted-foreground">
                          {item.number}.
                        </span>
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-normal"
                        >
                          {item.value}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render a single baseline tab content
  const renderBaselineContent = (data: FedRAMPBaselineData | undefined) => {
    if (!data) {
      return (
        <p className="text-sm text-muted-foreground italic">
          This control is not included in this baseline.
        </p>
      );
    }

    const hasParams = data.fedramp_parameters;
    const hasAddlReqs = data.additional_requirements;

    if (!hasParams && !hasAddlReqs) {
      return (
        <p className="text-sm text-muted-foreground italic">
          No FedRAMP-specific parameter values or requirements for this baseline.
        </p>
      );
    }

    return (
      <div className="space-y-6">
        {hasParams && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground/80">
              Parameter Values
            </h3>
            {renderParameterGroups(data.fedramp_parameters)}
          </div>
        )}
        {hasAddlReqs && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground/80">
              Additional Requirements and Guidance
            </h3>
            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardContent>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {data.additional_requirements}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  };

  return (
    <ControlSection title="FedRAMP Baseline Requirements">
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger
            value="low"
            disabled={!baselines.low?.included}
            className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400"
          >
            Low
          </TabsTrigger>
          <TabsTrigger
            value="moderate"
            disabled={!baselines.moderate?.included}
            className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-400"
          >
            Moderate
          </TabsTrigger>
          <TabsTrigger
            value="high"
            disabled={!baselines.high?.included}
            className="data-[state=active]:bg-rose-500/20 data-[state=active]:text-rose-700 dark:data-[state=active]:text-rose-400"
          >
            High
          </TabsTrigger>
        </TabsList>
        <TabsContent value="low" className="mt-0">
          {renderBaselineContent(baselines.low)}
        </TabsContent>
        <TabsContent value="moderate" className="mt-0">
          {renderBaselineContent(baselines.moderate)}
        </TabsContent>
        <TabsContent value="high" className="mt-0">
          {renderBaselineContent(baselines.high)}
        </TabsContent>
      </Tabs>
    </ControlSection>
  );
}

export function FedRampDiscussion({ control }: { control: FedRAMPControl }) {
  if (!control.discussion) return null;
  return <ProseSection title="Discussion" text={control.discussion} />;
}

export function GovRampDiscussion({ control }: { control: GovRAMPControl }) {
  if (!control.discussion) return null;
  return <ProseSection title="Discussion" text={control.discussion} />;
}
