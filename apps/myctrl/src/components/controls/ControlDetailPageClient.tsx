import * as React from 'react';
import { CompareButton } from './CompareButton';
import { ControlDetail } from './ControlDetail';
import { ControlNotes } from './ControlNotes';
import { CopyForLLM } from './CopyForLLM';
import {
  getControlBySlug,
  getFrameworkConfig,
  getNeighborControls,
  hasFrameworkData,
  isValidFramework,
} from '@/data/controls';

interface ControlDetailPageClientProps {
  frameworkId?: string;
  controlSlug?: string;
}

export function ControlDetailPageClient({
  frameworkId,
  controlSlug,
}: ControlDetailPageClientProps) {
  const control = React.useMemo(() => {
    if (!frameworkId || !controlSlug || !isValidFramework(frameworkId)) {
      return undefined;
    }

    return getControlBySlug(frameworkId, controlSlug);
  }, [frameworkId, controlSlug]);

  React.useEffect(() => {
    if (!frameworkId || !control) return;

    const title = `${control.control_id}: ${control.title} | myctrl.tools`;
    const description = control.description.substring(0, 160);
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  }, [control, frameworkId]);

  if (!frameworkId || !controlSlug || !isValidFramework(frameworkId)) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold">Control not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The requested framework or control path does not exist.
        </p>
        <a href="/all" className="mt-4 inline-flex text-sm text-primary hover:underline">
          Browse all frameworks
        </a>
      </div>
    );
  }

  const config = getFrameworkConfig(frameworkId);

  if (!hasFrameworkData(frameworkId)) {
    return (
      <div className="rounded-xl border border-[var(--ctp-peach)]/30 bg-card p-6 space-y-4">
        <h1 className="text-2xl font-semibold">{config.name} — Official Source Required</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {config.name} control text is not redistributed by this open-source deployment.
          Obtain the standard from its official publisher or load your self-licensed copy locally at{' '}
          <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
            src/data/local/{frameworkId}.json
          </code>.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          {config.officialUrl && (
            <a
              href={config.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Visit Official {config.name} Source ↗
            </a>
          )}
          <a
            href={`/frameworks/${frameworkId}`}
            className="inline-flex items-center px-4 py-2 rounded-lg border border-border text-sm hover:border-primary/50 transition-colors"
          >
            Local Overlay Instructions →
          </a>
        </div>
      </div>
    );
  }

  if (!control) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold">Control not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This control was not found in {config.name}.
        </p>
        <a href={`/frameworks/${frameworkId}`} className="mt-4 inline-flex text-sm text-primary hover:underline">
          View {config.name}
        </a>
      </div>
    );
  }

  const neighbors = getNeighborControls(frameworkId, control.control_id);

  return (
    <>
      <div className="mb-2 flex justify-end gap-2">
        <CopyForLLM control={control} frameworkId={frameworkId} frameworkName={config.name} />
        <CompareButton frameworkId={frameworkId} controlSlug={controlSlug} />
      </div>
      <ControlDetail control={control} frameworkId={frameworkId} neighbors={neighbors} />
      <ControlNotes frameworkId={frameworkId} controlSlug={controlSlug} />
    </>
  );
}
