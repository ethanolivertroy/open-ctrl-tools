import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FormattedMarkdown } from '../FormattedMarkdown';
import type { AIRMFControl } from '@/data/types';
import { ControlSection, SectionHeading } from './ControlSection';

export function AiRmfSections({ control }: { control: AIRMFControl }) {
  return (
    <>
      {/* AI RMF About */}
      {control.about && (
        <ControlSection title="About">
          <Card className="bg-muted/50 border-border py-3">
            <CardContent>
              <FormattedMarkdown text={control.about} />
            </CardContent>
          </Card>
        </ControlSection>
      )}

      {/* AI RMF Suggested Actions */}
      {control.suggested_actions && (
        <ControlSection title="Suggested Actions">
          <Card className="bg-primary/5 border-primary/20 py-3">
            <CardContent>
              <FormattedMarkdown text={control.suggested_actions} />
            </CardContent>
          </Card>
        </ControlSection>
      )}

      {/* AI RMF Documentation Guidance */}
      {control.documentation && (
        <ControlSection title="Documentation Guidance">
          <Card className="bg-muted/50 border-border py-3">
            <CardContent>
              <FormattedMarkdown text={control.documentation} />
            </CardContent>
          </Card>
        </ControlSection>
      )}

      {/* AI RMF References */}
      {control.references && (
        <ControlSection title="References">
          <Card className="bg-muted/50 border-border py-3">
            <CardContent>
              <FormattedMarkdown text={control.references} />
            </CardContent>
          </Card>
        </ControlSection>
      )}

      {/* AI RMF AI Actors and Topics */}
      {((control.ai_actors && control.ai_actors.length > 0) || (control.topics && control.topics.length > 0)) && (
        <section className="space-y-4">
          {control.ai_actors && control.ai_actors.length > 0 && (
            <div className="space-y-2">
              <SectionHeading>AI Actors</SectionHeading>
              <div className="flex flex-wrap gap-2">
                {control.ai_actors.map((actor, i) => (
                  <Badge key={i} variant="secondary" className="font-normal">
                    {actor}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {control.topics && control.topics.length > 0 && (
            <div className="space-y-2">
              <SectionHeading>Topics</SectionHeading>
              <div className="flex flex-wrap gap-2">
                {control.topics.map((topic, i) => (
                  <Badge key={i} variant="outline" className="font-normal">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
