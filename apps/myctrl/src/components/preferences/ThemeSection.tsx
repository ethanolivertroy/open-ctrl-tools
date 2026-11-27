import { useState, useEffect } from 'react';
import { type Theme, THEMES, THEME_COLORS, LIGHT_THEMES, applyTheme } from '@/lib/theme';

const DARK_THEMES = THEMES.filter(t => !LIGHT_THEMES.has(t.value));
const LIGHT_THEME_LIST = THEMES.filter(t => LIGHT_THEMES.has(t.value));

export function ThemeSection() {
  const [current, setCurrent] = useState<Theme>('dracula');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored && THEMES.some(t => t.value === stored)) {
      setCurrent(stored);
    } else {
      const dom = document.documentElement.getAttribute('data-theme') as Theme | null;
      if (dom && THEMES.some(t => t.value === dom)) {
        setCurrent(dom);
      }
    }
  }, []);

  const handleSelect = (theme: Theme) => {
    setCurrent(theme);
    localStorage.setItem('theme', theme);
    applyTheme(theme);
  };

  return (
    <section id="theme" className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="text-primary">{'>'}</span> Theme
      </h2>
      <p className="text-sm text-muted-foreground">
        Choose a color theme. Changes apply instantly.
      </p>

      <div className="space-y-6">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dark</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {DARK_THEMES.map(t => (
              <ThemeSwatch
                key={t.value}
                theme={t}
                isActive={current === t.value}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Light</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {LIGHT_THEME_LIST.map(t => (
              <ThemeSwatch
                key={t.value}
                theme={t}
                isActive={current === t.value}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ThemeSwatch({
  theme,
  isActive,
  onSelect,
}: {
  theme: { value: Theme; label: string };
  isActive: boolean;
  onSelect: (t: Theme) => void;
}) {
  const colors = THEME_COLORS[theme.value];

  return (
    <button
      type="button"
      onClick={() => onSelect(theme.value)}
      className={`relative p-3 rounded-lg border-2 transition-all text-left ${
        isActive
          ? 'border-primary ring-2 ring-primary/20'
          : 'border-border hover:border-primary/40'
      }`}
    >
      {/* Color preview bars */}
      <div className="flex gap-1 mb-2 h-6 rounded overflow-hidden">
        <div className="flex-1 rounded-sm" style={{ backgroundColor: colors.base }} />
        <div className="flex-1 rounded-sm" style={{ backgroundColor: colors.surface0 }} />
        <div className="flex-1 rounded-sm" style={{ backgroundColor: colors.text }} />
        <div className="flex-1 rounded-sm" style={{ backgroundColor: colors.mauve }} />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium truncate">{theme.label}</span>
        {isActive && (
          <svg className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    </button>
  );
}
