import { useState, useEffect, useRef } from 'react';

const SECTIONS = [
  { id: 'theme', label: 'Theme' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'projects', label: 'Projects' },
  { id: 'notes', label: 'Control Notes' },
  { id: 'recent', label: 'Recently Viewed' },
  { id: 'api-key', label: 'AI Providers' },
  { id: 'ai-data', label: 'AI Data' },
  { id: 'grc-agent', label: 'GRCLanker' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'presets', label: 'Filter Presets' },
  { id: 'storage', label: 'Storage & Data' },
];

export function PreferencesSidebar() {
  const [activeId, setActiveId] = useState('theme');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const callback: IntersectionObserverCallback = (entries) => {
      // Find the topmost visible section
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

      if (visible.length > 0) {
        setActiveId(visible[0].target.id);
      }
    };

    observerRef.current = new IntersectionObserver(callback, {
      rootMargin: '-80px 0px -60% 0px',
      threshold: 0,
    });

    for (const section of SECTIONS) {
      const el = document.getElementById(section.id);
      if (el) observerRef.current.observe(el);
    }

    return () => observerRef.current?.disconnect();
  }, []);

  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', `#${id}`);
    }
  };

  return (
    <nav className="hidden lg:block sticky top-24 w-48 shrink-0">
      <ul className="space-y-0.5">
        {SECTIONS.map(section => (
          <li key={section.id}>
            <button
              type="button"
              onClick={() => handleClick(section.id)}
              className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeId === section.id
                  ? 'text-primary bg-primary/10 font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {section.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
