import { Badge } from '@/components/ui/badge';
import { slugify, getBasePath } from '@/data/controls';
import type { NistControl } from '@/data/types';
import { ProseSection } from './ControlSection';

// Control Enhancements (NIST only)
export function NistEnhancements({ control, frameworkId }: { control: NistControl; frameworkId: string }) {
  if (!control.enhancements || control.enhancements.length === 0) return null;
  const basePath = getBasePath(frameworkId);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <span className="text-primary">{'>'}</span>
        Control Enhancements
        <span className="text-sm text-muted-foreground font-normal">
          ({control.enhancements.length})
        </span>
      </h2>
      <div className="flex flex-wrap gap-2">
        {control.enhancements.map((enhancementId) => (
          <a
            key={enhancementId}
            href={`${basePath}/${frameworkId}/${slugify(enhancementId)}`}
            className="inline-block"
          >
            <Badge variant="secondary" className="font-mono hover:bg-secondary/80 transition-colors">
              {enhancementId}
            </Badge>
          </a>
        ))}
      </div>
    </section>
  );
}

// Supplemental Guidance (NIST only) — rendered after the Relevant Technologies section
export function NistSupplementalGuidance({ control }: { control: NistControl }) {
  if (!control.supplemental_guidance) return null;
  return <ProseSection title="Supplemental Guidance" text={control.supplemental_guidance} />;
}
