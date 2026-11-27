import { useState, useEffect, useCallback } from 'react';
import { isFavorite, toggleFavorite } from '@/lib/storage/favorites-store';

interface FavoriteButtonProps {
  frameworkId: string;
  className?: string;
  /** Show only on parent hover (requires parent to have 'group' class) */
  showOnHover?: boolean;
}

export function FavoriteButton({ frameworkId, className = '', showOnHover = false }: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    isFavorite(frameworkId).then(setFavorited);
  }, [frameworkId]);

  // Handle keyboard shortcut (F key)
  const handleKeyboardToggle = useCallback(
    (e: CustomEvent<{ frameworkId: string }>) => {
      if (e.detail.frameworkId === frameworkId) {
        toggleFavorite(frameworkId).then(newState => setFavorited(newState));
      }
    },
    [frameworkId]
  );

  useEffect(() => {
    document.addEventListener('toggle-favorite', handleKeyboardToggle as EventListener);
    return () => {
      document.removeEventListener('toggle-favorite', handleKeyboardToggle as EventListener);
    };
  }, [handleKeyboardToggle]);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(frameworkId).then(newState => setFavorited(newState));
  };

  const visibilityClass = showOnHover
    ? favorited
      ? 'opacity-100'
      : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
    : '';

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`p-1.5 rounded-md hover:bg-muted transition-[transform,background-color,opacity] duration-[160ms] ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-95 ${visibilityClass} ${className}`}
      title={favorited ? 'Remove from favorites' : 'Add to favorites'}
      aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      <svg
        aria-hidden="true"
        className={`w-5 h-5 transition-colors ${
          favorited
            ? 'text-yellow-500 fill-yellow-500'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        fill={favorited ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
    </button>
  );
}
