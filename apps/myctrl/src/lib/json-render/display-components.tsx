import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  getAllControls,
  getFrameworkConfig,
  isValidFramework,
} from '@/data/controls';
import { getFavoriteFrameworks } from '@/lib/storage/favorites-store';
import { useDataValue } from '@json-render/react';
import { ErrorMessage, type ComponentProps } from './primitives';

export function AIStatCard({ config }: ComponentProps<'StatCard'>) {
  const { title, value: staticValue, dataPath, subtitle, trend, color = 'primary' } = config;
  const boundValue = useDataValue<string | number>(dataPath || '');
  const displayValue = dataPath ? boundValue : staticValue;

  const colorClasses = {
    primary: 'text-primary border-primary/30',
    success: 'text-green-700 dark:text-green-400 border-green-700/30 dark:border-green-400/30',
    warning: 'text-yellow-700 dark:text-yellow-400 border-yellow-700/30 dark:border-yellow-400/30',
    error: 'text-red-700 dark:text-red-400 border-red-700/30 dark:border-red-400/30',
  };

  return (
    <Card className={`bg-card border-2 ${colorClasses[color]}`}>
      <CardContent className="p-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={`text-3xl font-bold font-mono ${colorClasses[color].split(' ')[0]}`}>
            {displayValue ?? '—'}
            {trend && (
              <span className="ml-2 text-sm">
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
              </span>
            )}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function AIFrameworkCard({ config }: ComponentProps<'FrameworkCard'>) {
  const { frameworkId, showStats = true, showDescription = true, variant = 'compact' } = config;

  if (!isValidFramework(frameworkId)) {
    return <ErrorMessage message={`Unknown framework: ${frameworkId}`} />;
  }

  const framework = getFrameworkConfig(frameworkId);
  const controls = getAllControls(frameworkId);

  return (
    <Card className="bg-card border-border hover:border-primary/30 transition-colors">
      <CardHeader>
        <CardTitle>
          <a href={`/frameworks/${frameworkId}`} className="text-primary hover:underline">
            {framework.name}
          </a>
          <span className="ml-2 text-sm font-normal text-muted-foreground">v{framework.version}</span>
        </CardTitle>
        {showDescription && framework.description && (
          <CardDescription>{framework.description}</CardDescription>
        )}
      </CardHeader>
      {showStats && (
        <CardContent>
          <div className="flex gap-4">
            <div className="text-center">
              <p className="text-2xl font-mono font-bold">{controls.length}</p>
              <p className="text-xs text-muted-foreground">{framework.itemLabel || 'controls'}</p>
            </div>
            {framework.hasBaselines && (
              <div className="flex gap-2 items-center">
                <Badge variant="low">Low</Badge>
                <Badge variant="moderate">Mod</Badge>
                <Badge variant="high">High</Badge>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

const DEFAULT_EU_AI_ACT_EVENTS = [
  { date: '2025-02-02', label: 'Prohibited AI practices ban', description: 'Unacceptable risk AI systems banned', status: 'upcoming' as const, category: 'prohibited' },
  { date: '2025-08-02', label: 'GPAI model rules apply', description: 'General-purpose AI model obligations', status: 'upcoming' as const, category: 'gpai' },
  { date: '2026-08-02', label: 'High-risk AI in Annex III', description: 'Requirements for high-risk systems listed in Annex III', status: 'future' as const, category: 'high-risk' },
  { date: '2027-08-02', label: 'High-risk AI in Annex II', description: 'Requirements for high-risk systems in regulated products', status: 'future' as const, category: 'high-risk' },
];

export function AITimelineChart({ config }: ComponentProps<'TimelineChart'>) {
  const { frameworkId, events: customEvents, title, filterPast = false } = config;

  let events = customEvents;
  let chartTitle = title;

  if (!events) {
    if (frameworkId === 'eu-ai-act') {
      events = DEFAULT_EU_AI_ACT_EVENTS;
      chartTitle = chartTitle || 'EU AI Act Implementation Timeline';
    } else {
      return (
        <Card className="bg-muted/30 border-border">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              No timeline events available. Provide an <code className="text-primary">events</code> array or use a framework with built-in timeline data.
            </p>
          </CardContent>
        </Card>
      );
    }
  }

  const now = new Date();
  const processedEvents = events.map(event => {
    const eventDate = new Date(event.date);
    let status = event.status;
    if (!status) {
      if (eventDate < now) {
        status = 'past';
      } else if (eventDate.getTime() - now.getTime() < 90 * 24 * 60 * 60 * 1000) {
        status = 'upcoming';
      } else {
        status = 'future';
      }
    }
    return { ...event, parsedDate: eventDate, computedStatus: status };
  });

  const filteredEvents = filterPast
    ? processedEvents.filter(e => e.computedStatus !== 'past')
    : processedEvents;

  const sortedEvents = [...filteredEvents].sort(
    (a, b) => a.parsedDate.getTime() - b.parsedDate.getTime()
  );

  if (sortedEvents.length === 0) {
    return (
      <Card className="bg-muted/30 border-border">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            No upcoming events to display.
          </p>
        </CardContent>
      </Card>
    );
  }

  const statusColors = {
    past: 'border-muted-foreground/30 text-muted-foreground',
    upcoming: 'border-yellow-700/30 dark:border-yellow-400/30 text-yellow-700 dark:text-yellow-400 bg-yellow-400/5',
    current: 'border-green-700/30 dark:border-green-400/30 text-green-700 dark:text-green-400 bg-green-400/5',
    future: 'border-blue-700/30 dark:border-blue-400/30 text-blue-700 dark:text-blue-400',
  };

  const categoryColors: Record<string, string> = {
    prohibited: 'border-red-700/30 dark:border-red-400/30 text-red-700 dark:text-red-400',
    'high-risk': 'border-orange-700/30 dark:border-orange-400/30 text-orange-700 dark:text-orange-400',
    gpai: 'border-blue-700/30 dark:border-blue-400/30 text-blue-700 dark:text-blue-400',
    default: 'border-muted-foreground/30 text-muted-foreground',
  };

  return (
    <Card className="bg-card border-border">
      {chartTitle && (
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{chartTitle}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-3">
          {sortedEvents.map((event, i) => {
            const formattedDate = event.parsedDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: event.date.includes('-') && event.date.split('-').length === 3 ? 'numeric' : undefined,
            });

            const categoryClass = categoryColors[event.category || ''] || categoryColors.default;

            return (
              <div
                key={i}
                className={`flex items-start gap-4 p-2 rounded-lg transition-colors ${
                  event.computedStatus === 'upcoming' || event.computedStatus === 'current'
                    ? 'bg-muted/30'
                    : ''
                }`}
              >
                <div className="flex flex-col items-center shrink-0">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      event.computedStatus === 'past'
                        ? 'bg-muted-foreground'
                        : event.computedStatus === 'upcoming' || event.computedStatus === 'current'
                        ? 'bg-yellow-600 dark:bg-yellow-400'
                        : 'bg-blue-600 dark:bg-blue-400'
                    }`}
                  />
                  {i < sortedEvents.length - 1 && (
                    <div className="w-px h-full bg-border flex-1 mt-1" style={{ minHeight: '2rem' }} />
                  )}
                </div>

                <div className="w-24 shrink-0">
                  <span className={`text-xs font-mono ${event.computedStatus === 'past' ? 'text-muted-foreground' : 'text-primary'}`}>
                    {formattedDate}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${event.computedStatus === 'past' ? 'text-muted-foreground' : ''}`}>
                    {event.label}
                  </p>
                  {event.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                  )}
                </div>

                {event.category && (
                  <Badge variant="outline" className={`shrink-0 text-xs ${categoryClass}`}>
                    {event.category}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function AIFavoritesPanel({ config }: ComponentProps<'FavoritesPanel'>) {
  const { showNotes = true, variant = 'list' } = config;
  const [favorites, setFavorites] = React.useState<Array<{
    frameworkId: string;
    notes: string;
    addedAt: number;
  }>>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    getFavoriteFrameworks().then(loadedFavorites => {
      setFavorites(loadedFavorites);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Your Favorite Frameworks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading favorites...</p>
        </CardContent>
      </Card>
    );
  }

  if (favorites.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Your Favorite Frameworks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You haven't favorited any frameworks yet. Star frameworks you use frequently for quick access.
          </p>
          <a href="/all" className="text-primary hover:underline text-sm mt-2 inline-block">
            Browse all frameworks →
          </a>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'grid') {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Your Favorite Frameworks</span>
            <Badge variant="outline" className="text-xs">{favorites.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {favorites.map(fav => {
              const framework = isValidFramework(fav.frameworkId)
                ? getFrameworkConfig(fav.frameworkId)
                : null;
              return (
                <a
                  key={fav.frameworkId}
                  href={`/frameworks/${fav.frameworkId}`}
                  className="p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/50 transition-colors"
                >
                  <p className="text-sm font-medium truncate">
                    {framework?.name || fav.frameworkId}
                  </p>
                  {showNotes && fav.notes && (
                    <p className="text-xs text-muted-foreground truncate mt-1">{fav.notes}</p>
                  )}
                </a>
              );
            })}
          </div>
          <a href="/preferences#favorites" className="text-primary hover:underline text-xs mt-3 inline-block">
            Manage favorites →
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Your Favorite Frameworks</span>
          <Badge variant="outline" className="text-xs">{favorites.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {favorites.slice(0, 10).map(fav => {
            const framework = isValidFramework(fav.frameworkId)
              ? getFrameworkConfig(fav.frameworkId)
              : null;
            return (
              <a
                key={fav.frameworkId}
                href={`/frameworks/${fav.frameworkId}`}
                className="flex items-center justify-between p-2 rounded border border-transparent hover:border-border hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {framework?.name || fav.frameworkId}
                  </p>
                  {showNotes && fav.notes && (
                    <p className="text-xs text-muted-foreground truncate">{fav.notes}</p>
                  )}
                </div>
                {framework?.version && (
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    v{framework.version}
                  </span>
                )}
              </a>
            );
          })}
        </div>
        {favorites.length > 10 && (
          <p className="text-xs text-muted-foreground mt-2">
            +{favorites.length - 10} more
          </p>
        )}
        <a href="/preferences#favorites" className="text-primary hover:underline text-xs mt-3 inline-block">
          Manage all favorites →
        </a>
      </CardContent>
    </Card>
  );
}

export function AIProgressGauge({ config }: ComponentProps<'ProgressGauge'>) {
  const {
    value: staticValue,
    dataPath,
    max = 100,
    label,
    sublabel,
    variant = 'bar',
    thresholds,
    showValue = true,
  } = config;

  const boundValue = useDataValue<number>(dataPath || '');
  const value = dataPath && boundValue !== undefined ? boundValue : (staticValue ?? 0);
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const getColor = (): string => {
    if (!thresholds || thresholds.length === 0) {
      return 'primary';
    }

    const sorted = [...thresholds].sort((a, b) => b.value - a.value);
    for (const t of sorted) {
      if (percentage >= t.value) {
        return t.color;
      }
    }
    return sorted[sorted.length - 1]?.color || 'primary';
  };

  const color = getColor();
  const colorClass = {
    primary: 'text-primary',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-400',
  }[color] || '';

  const bgColorClass = {
    primary: 'bg-primary',
    success: 'bg-green-600 dark:bg-green-400',
    warning: 'bg-yellow-600 dark:bg-yellow-400',
    error: 'bg-red-600 dark:bg-red-400',
  }[color] || 'bg-primary';

  if (variant === 'circle') {
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative">
          <svg width="100" height="100" className="-rotate-90">
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-muted"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={colorClass || 'text-primary'}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          {showValue && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-xl font-bold font-mono ${colorClass}`}>
                {Math.round(percentage)}%
              </span>
            </div>
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">{label}</p>
          {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
        </div>
      </div>
    );
  }

  if (variant === 'semicircle') {
    const radius = 40;
    const circumference = Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative">
          <svg width="100" height="60" className="overflow-visible">
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              className="text-muted"
            />
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={colorClass || 'text-primary'}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          {showValue && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
              <span className={`text-lg font-bold font-mono ${colorClass}`}>
                {Math.round(percentage)}%
              </span>
            </div>
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">{label}</p>
          {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{label}</p>
          {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
        </div>
        {showValue && (
          <span className={`text-sm font-bold font-mono ${colorClass}`}>
            {value}/{max} ({Math.round(percentage)}%)
          </span>
        )}
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${bgColorClass || 'bg-primary'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
