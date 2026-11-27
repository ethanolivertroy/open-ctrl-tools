import { useRef, useState } from 'react';
import { useTypewriter } from '../../hooks/useTypewriter';

/**
 * Demo phrases that showcase the breadth of search functionality.
 * Each phrase demonstrates a different search pattern users might try.
 */
const DEMO_PHRASES = [
  "AC-2 access control",
  "GV.OC-01 governance",
  "encryption requirements",
  "EU AI Act high-risk",
];

/**
 * HeroSearch - A prominent search input for the homepage hero section
 *
 * Features a typewriter demo animation that cycles through search examples.
 * On submit, navigates to the full search page with the query string.
 */
export function HeroSearch() {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const demoMode = !focused && query === '';

  const { displayText, isTyping } = useTypewriter({
    phrases: DEMO_PHRASES,
    typeSpeed: { min: 50, max: 120 },
    deleteSpeed: 30,
    pauseBeforeDelete: 2000,
    pauseBeforeType: 500,
    enabled: demoMode,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    window.location.href = trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search';
  };

  return (
    <form
      onSubmit={handleSubmit}
      onClick={() => inputRef.current?.focus()}
      className="hero-search-glass w-full max-w-2xl mx-auto flex items-center gap-3 px-5 py-4 rounded-xl border transition-all cursor-text text-left group"
    >
      {/* Search icon */}
      <svg
        className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <circle cx="11" cy="11" r="8" strokeWidth="2" />
        <path d="m21 21-4.3-4.3" strokeWidth="2" strokeLinecap="round" />
      </svg>

      <div className="relative flex-1 min-w-0">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full bg-transparent text-foreground text-base md:text-lg outline-none placeholder:text-muted-foreground"
          placeholder={demoMode ? '' : "Search AC-2, GV.OC-01, or 'encryption'..."}
          aria-label="Search controls"
        />
        {/* Typewriter overlay shown when input is empty and unfocused */}
        {demoMode && (
          <span className="absolute inset-0 flex items-center text-foreground pointer-events-none text-base md:text-lg">
            {displayText}
            <span className={`typing-cursor ${isTyping ? '' : 'paused'}`} />
          </span>
        )}
      </div>
    </form>
  );
}
