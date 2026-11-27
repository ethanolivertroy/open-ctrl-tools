import { ProviderCatalogList } from '@/components/ai/ProviderCatalogList';

export function ProvidersSection() {
  return (
    <section id="api-key" className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="text-primary">{'>'}</span> AI Providers
      </h2>
      <p className="text-sm text-muted-foreground">
        Bring Your Own Key (BYOK) for AI features. Your keys are stored locally
        and sent directly to each provider — they never touch our servers.
      </p>

      <ProviderCatalogList />
    </section>
  );
}
