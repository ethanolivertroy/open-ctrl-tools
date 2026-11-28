import * as React from 'react';
import { applyTheme, normalizeTheme, type Theme } from '@/lib/theme';
import { setSkyMode, SKY_MODES } from '@/lib/cosmos/sky-mode';
import { useSkyMode } from './useSkyMode';

const THEMES: { id: Theme; label: string }[] = [
  { id: 'mocha', label: 'mocha' },
  { id: 'dracula', label: 'dracula' },
  { id: 'latte', label: 'latte' },
];

function currentTheme(): Theme {
  return normalizeTheme(document.documentElement.getAttribute('data-theme'));
}

/** Small telemetry bar in the hero: sky motion on every screen, colour theme from `sm` up. */
export function SkyControls() {
  const skyMode = useSkyMode();
  const [activeTheme, setActiveTheme] = React.useState<Theme>('mocha');

  React.useEffect(() => {
    setActiveTheme(currentTheme());
    const observer = new MutationObserver(() => setActiveTheme(currentTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const switchTheme = (theme: Theme) => {
    applyTheme(theme);
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // Ignore storage quota / privacy mode errors
    }
    setActiveTheme(theme);
  };

  // Roomier targets on touch screens, compact on desktop.
  const pill = (active: boolean) =>
    `px-3 py-2 sm:px-1.5 sm:py-0.5 rounded transition-colors ${
      active ? 'bg-primary/15 text-primary font-medium' : 'hover:text-foreground'
    }`;

  return (
    <div className="absolute bottom-4 left-4 sm:left-auto sm:right-4 z-20 flex items-center gap-3 rounded-lg border border-border/50 bg-background/75 backdrop-blur-md px-2 py-1 sm:px-2.5 text-xs sm:text-[11px] font-mono text-muted-foreground">
      <div className="flex items-center gap-1" role="group" aria-label="Sky motion">
        <span className="text-muted-foreground/70 mr-1">sky:</span>
        {SKY_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setSkyMode(mode)}
            aria-pressed={skyMode === mode}
            className={pill(skyMode === mode)}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Phones get the sky switch only; themes are a tap away in Preferences (the header gear). */}
      <span className="hidden sm:block h-3 w-px bg-border/60" aria-hidden="true" />

      <div className="hidden sm:flex items-center gap-1" role="group" aria-label="Color theme">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchTheme(t.id)}
            aria-pressed={activeTheme === t.id}
            className={pill(activeTheme === t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
