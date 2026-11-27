/**
 * ProviderSelector Component
 *
 * Compact dropdown for quick-switching between configured AI providers.
 * Shows current provider + model, with a dropdown to switch.
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { isOllamaCloud } from '@/lib/ai/ollama-utils';
import { PROVIDERS, type ProviderId } from '@/lib/ai/providers';
import type { ProviderConfigRecord } from '@/lib/storage-types';
import { useConfiguredProviders } from './useConfiguredProviders';

interface ProviderSelectorProps {
  activeProvider: ProviderId;
  activeModel: string;
  onProviderChange: (providerId: ProviderId, model: string) => void;
}

export function ProviderSelector({
  activeProvider,
  activeModel,
  onProviderChange,
}: ProviderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    enabledProviders,
    selectDefaultProvider,
  } = useConfiguredProviders({
    autoLoad: isOpen,
  });

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const handleSelect = useCallback((config: ProviderConfigRecord) => {
    onProviderChange(config.providerId, config.model);
    void selectDefaultProvider(config.providerId);
    setIsOpen(false);
  }, [onProviderChange, selectDefaultProvider]);

  const providerInfo = PROVIDERS[activeProvider];
  const modelName = providerInfo?.models.find(m => m.id === activeModel)?.name
    || activeModel
    || providerInfo?.name;
  const currentProviderLabel = providerInfo?.name
    ? (modelName && modelName !== providerInfo.name
        ? `${providerInfo.name} · ${modelName}`
        : providerInfo.name)
    : modelName;

  // Don't render if no providers configured or only one
  if (enabledProviders.length <= 1) {
    return (
      <span className="text-xs text-muted-foreground px-2 py-1 rounded bg-muted/30">
        {currentProviderLabel}
      </span>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        title="Switch AI provider"
      >
        <span className="font-medium max-w-[15rem] truncate">{currentProviderLabel}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-56 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          {enabledProviders.map((config) => {
            const info = PROVIDERS[config.providerId];
            if (!info) return null;
            const model = info.models.find(m => m.id === config.model);
            const isActive = config.providerId === activeProvider;

            return (
              <button
                key={config.providerId}
                onClick={() => handleSelect(config)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors ${
                  isActive ? 'bg-muted/30' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{info.name}</span>
                    {(() => {
                      const isCloudModel = model?.isCloud
                        || /cloud/i.test(config.model)
                        || (config.providerId === 'ollama' && !!config.baseUrl && isOllamaCloud(config.baseUrl));
                      if (isCloudModel) {
                        return (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-500 font-medium">
                            Cloud
                          </span>
                        );
                      }
                      if (info.isLocal && config.providerId !== 'chrome-ai') {
                        return (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 font-medium">
                            Local
                          </span>
                        );
                      }
                      return null;
                    })()}
                    {config.providerId === 'chrome-ai' && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 font-medium">
                        Zero download
                      </span>
                    )}
                    {typeof model?.supportsStructuredOutput === 'boolean' && (
                      model.supportsStructuredOutput ? (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">
                          JSON Views
                        </span>
                      ) : (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-medium">
                          Text only
                        </span>
                      )
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {model?.name || config.model}
                  </span>
                </div>
                {isActive && (
                  <Check className="w-4 h-4 text-primary shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ProviderSelector;
