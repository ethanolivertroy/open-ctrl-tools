/**
 * AIPanel - Global keyboard-shortcut-driven wrapper for AISlidePanel
 *
 * Listens for the 'open-ai-panel' custom event (dispatched by Cmd+J)
 * and opens the AI slide panel with page context.
 */

import { useState, useEffect, useCallback } from 'react';
import { AISlidePanel } from './AISlidePanel';
import type { AIContext } from '@/lib/ai-data-context';

interface AIPanelProps {
  frameworkId?: string;
  controlSlug?: string;
}

function deriveContext(frameworkId?: string, controlSlug?: string): AIContext | undefined {
  if (!frameworkId) return undefined;
  return {
    frameworkId,
    controlId: controlSlug,
  };
}

export function AIPanel({ frameworkId, controlSlug }: AIPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    document.addEventListener('open-ai-panel', handleOpen);
    return () => document.removeEventListener('open-ai-panel', handleOpen);
  }, [handleOpen]);

  return (
    <AISlidePanel
      isOpen={isOpen}
      onClose={handleClose}
      context={deriveContext(frameworkId, controlSlug)}
    />
  );
}

export default AIPanel;
