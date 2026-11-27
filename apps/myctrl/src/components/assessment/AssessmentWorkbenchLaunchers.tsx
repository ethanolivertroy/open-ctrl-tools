import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Assessment } from '@/lib/db';
import {
  getAssessmentLabel,
  getPrimaryAssessmentFrameworkId,
} from '@/lib/assessment-frameworks';
import { Bot, ClipboardList, LayoutPanelTop, ListChecks, Radar, UsersRound } from 'lucide-react';

interface AssessmentWorkbenchLaunchersProps {
  assessment: Assessment;
  onOpenPrompt: (prompt: string) => void;
}

interface LauncherDefinition {
  icon: typeof LayoutPanelTop;
  title: string;
  description: string;
  prompt: string;
}

export function AssessmentWorkbenchLaunchers({
  assessment,
  onOpenPrompt,
}: AssessmentWorkbenchLaunchersProps) {
  const frameworkId = getPrimaryAssessmentFrameworkId(assessment.targetFrameworks);
  const scopeLabel = getAssessmentLabel(frameworkId, assessment.targetBaseline);

  const launchers: LauncherDefinition[] = [
    {
      icon: LayoutPanelTop,
      title: 'Assessment Workbench',
      description: 'Open a full operator view with readiness, weak families, and priority gaps.',
      prompt: `Open a full assessment workbench for the ${scopeLabel} assessment named ${assessment.name}. Show readiness, the weakest families, and the highest-priority gaps that still need remediation.`,
    },
    {
      icon: Radar,
      title: 'Readiness Overview',
      description: 'Start with coverage, current posture, and family-level readiness.',
      prompt: `Show a readiness overview for the ${scopeLabel} assessment named ${assessment.name}. Focus on overall coverage, status distribution, and the families with the most remaining work.`,
    },
    {
      icon: ListChecks,
      title: 'Priority Gaps',
      description: 'Jump straight into open gaps, blockers, and remediation-focused work.',
      prompt: `Show the priority gaps for the ${scopeLabel} assessment named ${assessment.name}. Focus on missing controls, partial implementations, blockers, and the next remediation steps.`,
    },
    {
      icon: UsersRound,
      title: 'Owner Buckets',
      description: 'Group open work by owner so unassigned and overloaded controls stand out fast.',
      prompt: `Show the remediation queue for the ${scopeLabel} assessment named ${assessment.name}. Group open controls by owner, call out unassigned work, and highlight the next remediation actions.`,
    },
    {
      icon: ClipboardList,
      title: 'Evidence Prep',
      description: 'Focus on artifacts, interview prep, and the controls that still need proof.',
      prompt: `Show the evidence prep view for the ${scopeLabel} assessment named ${assessment.name}. Focus on the artifacts, evidence notes, interview topics, and documentation gaps that an assessor would expect to review.`,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          AI Workbench Starters
        </CardTitle>
        <CardDescription>
          Open assessment-native views without having to craft the prompt yourself.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {launchers.map(({ icon: Icon, title, description, prompt }) => (
          <div
            key={title}
            className="rounded-xl border border-border bg-card/50 p-4 space-y-4"
          >
            <div className="space-y-2">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h3 className="font-medium">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onOpenPrompt(prompt)}
            >
              Open in AI Builder
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
