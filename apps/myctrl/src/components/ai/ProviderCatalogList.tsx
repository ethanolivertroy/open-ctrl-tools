import { useCallback, useState } from 'react';
import {
  Brain,
  Zap,
  Gem,
  Route,
  HardDrive,
  Cpu,
  Globe,
  Sparkles,
  MousePointer2,
  Check,
  Circle,
  Star,
  ChevronRight,
} from 'lucide-react';
import { isOllamaCloud } from '@/lib/ai/ollama-utils';
import { getAllProviders, type ProviderConfig, type ProviderId } from '@/lib/ai/providers';
import type { ProviderConfigRecord } from '@/lib/storage-types';
import { ProviderSetup } from './ProviderSetup';
import { useConfiguredProviders } from './useConfiguredProviders';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Brain,
  Zap,
  Gem,
  Route,
  HardDrive,
  Cpu,
  Globe,
  Sparkles,
  MousePointer2,
};

interface ProviderCatalogListProps {
  autoLoad?: boolean;
  onProvidersChanged?: () => void;
}

interface ProviderRowProps {
  provider: ProviderConfig;
  config: ProviderConfigRecord | undefined;
  isDefault: boolean;
  onOpen: (id: ProviderId) => void;
  onSetDefault: (id: ProviderId) => void;
}

function providerBadge(provider: ProviderConfig, config: ProviderConfigRecord | undefined, modelIsCloud: boolean) {
  if (provider.id === 'gemini') return { label: 'Free tier', className: 'bg-green-500/10 text-green-500' };
  if (provider.isLocal) {
    return modelIsCloud
      ? { label: 'Cloud', className: 'bg-purple-500/10 text-purple-500' }
      : { label: 'Local', className: 'bg-green-500/10 text-green-500' };
  }
  if (provider.id === 'grok' && config?.oauth?.refreshToken) {
    return { label: 'X Premium', className: 'bg-sky-500/10 text-sky-500' };
  }
  if (provider.id === 'grok' && !config) {
    return { label: 'X Premium', className: 'bg-sky-500/10 text-sky-500' };
  }
  return null;
}

function ProviderRow({ provider, config, isDefault, onOpen, onSetDefault }: ProviderRowProps) {
  const isConfigured = !!config;
  const Icon = ICON_MAP[provider.icon] || Circle;
  const model = config
    ? provider.models.find((item) => item.id === config.model)
    : null;
  const modelIsCloud = !!model?.isCloud
    || !!(config?.model && /cloud/i.test(config.model))
    || (provider.id === 'ollama' && !!config?.baseUrl && isOllamaCloud(config.baseUrl));
  const badge = providerBadge(provider, config, modelIsCloud);

  return (
    <button
      type="button"
      onClick={() => onOpen(provider.id)}
      className="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
          isConfigured ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{provider.name}</span>
          {isDefault && (
            <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              <Star className="h-2.5 w-2.5 fill-current" />
              Default
            </span>
          )}
          {badge && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}>
              {badge.label}
            </span>
          )}
          {provider.supportsRealtimeVoice && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              Voice
            </span>
          )}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {isConfigured ? model?.name || config.model : provider.description}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        {isConfigured && !isDefault && (
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onSetDefault(provider.id);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onSetDefault(provider.id);
              }
            }}
            className="rounded px-2 py-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-primary focus-visible:opacity-100 group-hover:opacity-100"
            title="Set as default"
          >
            Set default
          </span>
        )}
        {isConfigured ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/10">
            <Check className="h-3 w-3 text-green-500" />
          </span>
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
        )}
      </span>
    </button>
  );
}

function ProviderGroup({
  label,
  hint,
  providers,
  configuredProviders,
  defaultProviderId,
  onOpen,
  onSetDefault,
}: {
  label: string;
  hint?: string;
  providers: ProviderConfig[];
  configuredProviders: Map<ProviderId, ProviderConfigRecord>;
  defaultProviderId: ProviderId | null;
  onOpen: (id: ProviderId) => void;
  onSetDefault: (id: ProviderId) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</h3>
        {hint && <span className="text-[11px] text-muted-foreground/60">{hint}</span>}
      </div>
      <div className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border">
        {providers.map((provider) => (
          <ProviderRow
            key={provider.id}
            provider={provider}
            config={configuredProviders.get(provider.id)}
            isDefault={provider.id === defaultProviderId}
            onOpen={onOpen}
            onSetDefault={onSetDefault}
          />
        ))}
      </div>
    </div>
  );
}

export function ProviderCatalogList({
  autoLoad = true,
  onProvidersChanged,
}: ProviderCatalogListProps) {
  const [setupProvider, setSetupProvider] = useState<ProviderId | null>(null);
  const {
    enabledProviders,
    defaultProviderId,
    loadProviders,
    selectDefaultProvider,
  } = useConfiguredProviders({ autoLoad });
  const configuredProviders = new Map(
    enabledProviders.map((config) => [config.providerId, config]),
  );

  const handleConfigured = useCallback(() => {
    void loadProviders();
    onProvidersChanged?.();
  }, [loadProviders, onProvidersChanged]);

  const handleSetDefault = useCallback((providerId: ProviderId) => {
    void selectDefaultProvider(providerId).then(() => onProvidersChanged?.());
  }, [onProvidersChanged, selectDefaultProvider]);

  const allProviders = getAllProviders();
  const cloudProviders = allProviders.filter((p) => !p.isLocal);
  const localProviders = allProviders.filter((p) => p.isLocal);

  return (
    <>
      <div className="space-y-6">
        <ProviderGroup
          label="Bring your own key"
          hint="Keys stay in your browser"
          providers={cloudProviders}
          configuredProviders={configuredProviders}
          defaultProviderId={defaultProviderId}
          onOpen={setSetupProvider}
          onSetDefault={handleSetDefault}
        />
        <ProviderGroup
          label="Runs on your device"
          hint="Free, fully private"
          providers={localProviders}
          configuredProviders={configuredProviders}
          defaultProviderId={defaultProviderId}
          onOpen={setSetupProvider}
          onSetDefault={handleSetDefault}
        />
      </div>

      {setupProvider && (
        <ProviderSetup
          providerId={setupProvider}
          isOpen={!!setupProvider}
          onClose={() => setSetupProvider(null)}
          onConfigured={handleConfigured}
        />
      )}
    </>
  );
}
