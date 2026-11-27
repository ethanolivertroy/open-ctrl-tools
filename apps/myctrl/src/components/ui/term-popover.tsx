/**
 * TermPopover — hover/tap popover for defined term badges.
 *
 * Desktop: hover-to-open (200ms delay), hover-to-close (150ms delay)
 * Mobile: tap-to-open, tap-outside-to-close
 * No new dependencies — pure CSS + React state.
 */

import * as React from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Badge } from './badge';
import type { GlossaryTerm } from '@/data/fedramp-20x-glossary';

interface TermPopoverProps {
  term: GlossaryTerm;
  children: string;
}

export function TermPopover({ term, children }: TermPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearTimers();
    openTimerRef.current = setTimeout(() => setIsOpen(true), 200);
  }, [clearTimers]);

  const handleMouseLeave = useCallback(() => {
    clearTimers();
    closeTimerRef.current = setTimeout(() => setIsOpen(false), 150);
  }, [clearTimers]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsOpen(prev => !prev);
  }, []);

  // Close on tap outside (mobile)
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Cleanup timers on unmount
  useEffect(() => clearTimers, [clearTimers]);

  return (
    <span
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Badge
        variant="outline"
        className="text-xs font-normal cursor-help border-dashed hover:bg-muted transition-colors"
        onClick={handleClick}
      >
        {children}
      </Badge>

      {isOpen && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-72 max-w-[90vw] rounded-lg border border-border bg-popover p-3 shadow-md text-popover-foreground"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="w-2 h-2 rotate-45 border-r border-b border-border bg-popover" />
          </div>

          <p className="text-xs font-semibold mb-1">{term.term}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {term.definition}
          </p>
          {term.note && (
            <p className="text-xs text-muted-foreground/80 italic mt-1.5 leading-relaxed">
              {term.note}
            </p>
          )}
        </div>
      )}
    </span>
  );
}
