import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { ITSG33Control } from '@/data/types';
import { ControlSection, ProseSection } from './ControlSection';

// Supplemental + Tailoring guidance; rendered before the NIST 800-171 discussion slot
export function Itsg33GuidanceSections({ control }: { control: ITSG33Control }) {
  return (
    <>
      {/* ITSG-33 Supplemental Guidance */}
      {control.discussion && (
        <ProseSection title="Supplemental Guidance" text={control.discussion} />
      )}

      {/* ITSG-33 Tailoring Guidance */}
      {control.tailoring_guidance && (
        <ProseSection
          title="Tailoring Guidance"
          text={control.tailoring_guidance}
          cardClassName="bg-emerald-500/5 border-emerald-500/20 py-3"
        />
      )}
    </>
  );
}

// ITSG-33 Profile Parameters (Tabbed)
export function Itsg33ProfileParameters({ control }: { control: ITSG33Control }) {
  const profiles = control.profiles;
  const inPBMM = profiles.pbmm?.included;
  const inSecret = profiles.secret?.included;

  // Check if either profile has parameters to display
  const hasParams = profiles.pbmm?.parameters || profiles.secret?.parameters;
  if (!hasParams) return null;

  const defaultTab = inPBMM ? 'pbmm' : 'secret';

  return (
    <ControlSection title="Profile-Specific Parameters">
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger
            value="pbmm"
            disabled={!inPBMM}
            className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400"
          >
            PBMM
          </TabsTrigger>
          <TabsTrigger
            value="secret"
            disabled={!inSecret}
            className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-400"
          >
            Secret
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pbmm" className="mt-0">
          {profiles.pbmm?.parameters ? (
            <Card className="bg-emerald-500/5 border-emerald-500/20">
              <CardContent>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {profiles.pbmm.parameters}
                </p>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No specific parameters for PBMM profile.
            </p>
          )}
        </TabsContent>
        <TabsContent value="secret" className="mt-0">
          {profiles.secret?.parameters ? (
            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardContent>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {profiles.secret.parameters}
                </p>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No specific parameters for Secret profile.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </ControlSection>
  );
}
