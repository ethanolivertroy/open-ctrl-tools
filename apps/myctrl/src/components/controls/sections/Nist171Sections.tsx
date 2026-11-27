import type { NIST171Control } from '@/data/types';
import { ProseSection } from './ControlSection';

export function Nist171Sections({ control }: { control: NIST171Control }) {
  if (!control.discussion) return null;
  return <ProseSection title="Discussion" text={control.discussion} />;
}
