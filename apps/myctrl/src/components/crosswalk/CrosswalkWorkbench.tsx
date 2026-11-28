import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CoverageMatrix } from '@/components/crosswalk/CoverageMatrix';
import { ControlExplorer } from '@/components/crosswalk/ControlExplorer';
import { LayoutGrid, Compass } from 'lucide-react';

type WorkbenchTab = 'matrix' | 'explorer';

export function CrosswalkWorkbench() {
  const [activeTab, setActiveTab] = React.useState<WorkbenchTab>('matrix');

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('tab');
    if (requested === 'explorer' || requested === 'matrix') {
      setActiveTab(requested);
    }
  }, []);

  const handleTabChange = (next: string) => {
    const value: WorkbenchTab = next === 'explorer' ? 'explorer' : 'matrix';
    setActiveTab(value);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', value);
      window.history.replaceState({}, '', url.toString());
    } catch {
      // Ignore history errors in restricted contexts
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-4">
        <TabsList className="grid w-full sm:w-auto sm:inline-grid grid-cols-2">
          <TabsTrigger value="matrix" className="gap-2 px-4">
            <LayoutGrid className="h-4 w-4" />
            <span>Coverage Matrix</span>
          </TabsTrigger>
          <TabsTrigger value="explorer" className="gap-2 px-4">
            <Compass className="h-4 w-4" />
            <span>Control Explorer</span>
          </TabsTrigger>
        </TabsList>

        <p className="text-xs font-mono text-muted-foreground">
          Lazy-loaded precomputed crosswalk matrices · Zero heavy bundle upfront
        </p>
      </div>

      <TabsContent value="matrix" className="mt-0">
        <CoverageMatrix />
      </TabsContent>

      <TabsContent value="explorer" className="mt-0">
        <ControlExplorer />
      </TabsContent>
    </Tabs>
  );
}
