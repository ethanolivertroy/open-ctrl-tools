import { useState, useEffect } from 'react';
import type { RecentlyViewed } from '@/lib/db';
import { getRecentlyViewed, clearRecentlyViewed } from '@/lib/storage/recently-viewed-store';

export function RecentlyViewedSection() {
  const [items, setItems] = useState<RecentlyViewed[]>([]);

  useEffect(() => {
    getRecentlyViewed().then(setItems);
  }, []);

  const handleClear = () => {
    clearRecentlyViewed();
    setItems([]);
  };

  return (
    <section id="recent" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span className="text-primary">{'>'}</span> Recently Viewed
        </h2>
        {items.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Clear History
          </button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Frameworks and controls you've visited recently.
      </p>

      {items.length === 0 ? (
        <div className="text-center py-12 rounded-lg border border-border bg-card">
          <p className="text-muted-foreground text-sm">No recently viewed items.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {items.map(item => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors group"
            >
              <span className="text-muted-foreground text-sm shrink-0">
                {item.type === 'control' ? '📋' : '📚'}
              </span>
              <span className="text-sm flex-1 truncate group-hover:text-primary transition-colors">
                {item.title}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatRelativeTime(item.viewedAt)}
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
