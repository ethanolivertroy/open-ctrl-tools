import { useState, useEffect } from 'react';
import { getNavigationScope, setNavigationScope, type NavigationScope } from '@/lib/storage/settings-store';

const OPTIONS: { value: NavigationScope; label: string; description: string }[] = [
  { value: 'all', label: 'All controls', description: 'Show every control in the sidebar navigation.' },
  { value: 'family', label: 'Current family only', description: 'Show only controls in the current family for a focused view.' },
];

export function NavigationSection() {
  const [scope, setScope] = useState<NavigationScope>('all');

  useEffect(() => {
    getNavigationScope().then(setScope);
  }, []);

  const handleChange = (value: NavigationScope) => {
    setScope(value);
    setNavigationScope(value);
  };

  return (
    <section id="navigation" className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="text-primary">{'>'}</span> Navigation
      </h2>
      <p className="text-sm text-muted-foreground">
        Control how the sidebar displays controls when browsing a framework.
      </p>

      <div className="space-y-2">
        {OPTIONS.map(opt => (
          <label
            key={opt.value}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              scope === opt.value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/30'
            }`}
          >
            <input
              type="radio"
              name="nav-scope"
              value={opt.value}
              checked={scope === opt.value}
              onChange={() => handleChange(opt.value)}
              className="mt-1 accent-[var(--color-primary)]"
            />
            <div>
              <p className="text-sm font-medium">{opt.label}</p>
              <p className="text-xs text-muted-foreground">{opt.description}</p>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
