import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { DoDSRGControl, DoDImpactLevelData } from '@/data/types';
import { ControlSection, ProseSection } from './ControlSection';

// DoD SRG Impact Level-Specific Data (Tabbed)
function DodSrgImpactLevelTabs({ control }: { control: DoDSRGControl }) {
  const levels = control.impact_levels;
  const isIncluded = (data?: DoDImpactLevelData) => data?.included;

  const inIL4Mod = isIncluded(levels.il4_mod);
  const inIL4High = isIncluded(levels.il4_high);
  const inIL5 = isIncluded(levels.il5);
  const inIL6 = isIncluded(levels.il6);

  if (!inIL4Mod && !inIL4High && !inIL5 && !inIL6) return null;

  // Determine default tab (highest applicable level)
  const defaultTab = inIL6 ? 'il6' : inIL5 ? 'il5' : inIL4High ? 'il4_high' : 'il4_mod';

  // Render a single impact level tab content
  const renderImpactLevelContent = (data: DoDImpactLevelData | undefined) => {
    if (!data) {
      return (
        <p className="text-sm text-muted-foreground italic">
          This control is not included at this impact level.
        </p>
      );
    }

    const hasFedrampParams = data.fedramp_parameters;
    const hasDodParams = data.dod_parameters;
    const hasAddlReqs = data.additional_requirements;

    if (!hasFedrampParams && !hasDodParams && !hasAddlReqs) {
      return (
        <p className="text-sm text-muted-foreground italic">
          No specific parameter values or requirements for this impact level.
        </p>
      );
    }

    return (
      <div className="space-y-6">
        {hasFedrampParams && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground/80">
              FedRAMP Parameter Values
            </h3>
            <Card className="bg-emerald-500/5 border-emerald-500/20">
              <CardContent>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {data.fedramp_parameters}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
        {hasDodParams && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground/80">
              DoD FedRAMP+ Parameters
            </h3>
            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {data.dod_parameters}
                </p>
              </CardContent>
            </Card>
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
    <ControlSection title="DoD Impact Level Requirements">
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger
            value="il4_mod"
            disabled={!levels.il4_mod?.included}
            className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400"
          >
            IL4 Mod
          </TabsTrigger>
          <TabsTrigger
            value="il4_high"
            disabled={!levels.il4_high?.included}
            className="data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-400"
          >
            IL4 High
          </TabsTrigger>
          <TabsTrigger
            value="il5"
            disabled={!levels.il5?.included}
            className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-400"
          >
            IL5
          </TabsTrigger>
          <TabsTrigger
            value="il6"
            disabled={!levels.il6?.included}
            className="data-[state=active]:bg-rose-500/20 data-[state=active]:text-rose-700 dark:data-[state=active]:text-rose-400"
          >
            IL6
          </TabsTrigger>
        </TabsList>
        <TabsContent value="il4_mod" className="mt-0">
          {renderImpactLevelContent(levels.il4_mod)}
        </TabsContent>
        <TabsContent value="il4_high" className="mt-0">
          {renderImpactLevelContent(levels.il4_high)}
        </TabsContent>
        <TabsContent value="il5" className="mt-0">
          {renderImpactLevelContent(levels.il5)}
        </TabsContent>
        <TabsContent value="il6" className="mt-0">
          {renderImpactLevelContent(levels.il6)}
        </TabsContent>
      </Tabs>
    </ControlSection>
  );
}

export function DodSrgSections({ control }: { control: DoDSRGControl }) {
  return (
    <>
      <DodSrgImpactLevelTabs control={control} />
      {/* DoD SRG Discussion */}
      {control.discussion && <ProseSection title="Discussion" text={control.discussion} />}
    </>
  );
}
