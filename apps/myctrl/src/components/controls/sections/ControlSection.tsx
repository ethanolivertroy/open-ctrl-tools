import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FormattedProse } from '../FormattedProse';

// Standard "> Title" section heading used across control detail sections
export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold flex items-center gap-2">
      <span className="text-primary">{'>'}</span>
      {children}
    </h2>
  );
}

interface ControlSectionProps {
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ControlSection({ title, children, className = 'space-y-4' }: ControlSectionProps) {
  return (
    <section className={className}>
      <SectionHeading>{title}</SectionHeading>
      {children}
    </section>
  );
}

interface ProseSectionProps {
  title: string;
  text: string;
  cardClassName?: string;
}

// Repeated "Discussion"-style pattern: section + Card + FormattedProse
export function ProseSection({ title, text, cardClassName = 'bg-muted/50 border-border py-3' }: ProseSectionProps) {
  return (
    <ControlSection title={title}>
      <Card className={cardClassName}>
        <CardContent>
          <FormattedProse text={text} />
        </CardContent>
      </Card>
    </ControlSection>
  );
}
