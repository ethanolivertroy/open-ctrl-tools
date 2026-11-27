import { useState, useRef, useEffect } from 'react';
import type { Control, FrameworkConfig } from '../../data/types';
import {
  exportControls,
  getOfficialDownloadUrl,
  getOfficialDownloadLabel,
} from '../../lib/export';
import { cn } from '../../lib/utils';

interface ExportButtonProps {
  controls: Control[];
  config: FrameworkConfig;
  filters?: Record<string, string>;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm';
  className?: string;
}

export function ExportButton({
  controls,
  config,
  filters,
  variant = 'default',
  size = 'default',
  className,
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Check if framework requires redirect to official source
  const officialUrl = getOfficialDownloadUrl(config.id, config);

  // Protected framework - link to official download instead of local export
  if (officialUrl) {
    const label = getOfficialDownloadLabel(config.id, config);
    return (
      <a
        href={officialUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center gap-2 rounded-md text-sm font-medium transition-colors',
          variant === 'outline' && 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
          variant === 'ghost' && 'hover:bg-accent hover:text-accent-foreground',
          variant === 'default' && 'bg-primary text-primary-foreground hover:bg-primary/90',
          size === 'sm' ? 'h-8 px-3' : 'h-9 px-4',
          className
        )}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        {label}
      </a>
    );
  }

  const handleExport = (format: 'csv' | 'json') => {
    exportControls(controls, config, format, filters);
    setIsOpen(false);
  };

  const filterLabel = filters
    ? Object.values(filters).filter(Boolean).join(', ')
    : null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center gap-2 rounded-md text-sm font-medium transition-colors cursor-pointer',
          variant === 'outline' && 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
          variant === 'ghost' && 'hover:bg-accent hover:text-accent-foreground',
          variant === 'default' && 'bg-primary text-primary-foreground hover:bg-primary/90',
          size === 'sm' ? 'h-8 px-3' : 'h-9 px-4',
          className
        )}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export Controls
        <svg className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown menu */}
          <div className="absolute right-0 mt-1 w-64 rounded-md border border-border bg-card shadow-lg z-20">
            {/* Header with context */}
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs text-muted-foreground">
                {controls.length} {controls.length === 1 ? 'control' : 'controls'}
                {filterLabel && <span> ({filterLabel})</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Import into Drata, Vanta, ServiceNow, or any spreadsheet
              </p>
            </div>
            <div className="py-1">
              <button
                onClick={() => handleExport('csv')}
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <span className="font-medium">CSV</span>
                  <span className="text-xs text-muted-foreground ml-2">Excel, Google Sheets</span>
                </div>
              </button>
              <button
                onClick={() => handleExport('json')}
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <div>
                  <span className="font-medium">JSON</span>
                  <span className="text-xs text-muted-foreground ml-2">API, GRC platforms</span>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
