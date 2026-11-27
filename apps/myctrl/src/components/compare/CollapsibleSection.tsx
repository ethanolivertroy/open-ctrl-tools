import { useState, type ReactNode } from 'react';
import { ChevronRightIcon } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  forceOpen,
  children,
}: CollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = forceOpen !== undefined ? forceOpen : internalOpen;

  return (
    <div className="border-t border-border/50">
      <button
        type="button"
        onClick={() => {
          if (forceOpen === undefined) setInternalOpen(!internalOpen);
        }}
        aria-expanded={isOpen}
        className="flex items-center gap-2 w-full py-2 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
      >
        <ChevronRightIcon
          className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
        />
        {title}
      </button>
      <div
        inert={!isOpen}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:duration-0 ${
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-3">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
