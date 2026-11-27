import { useEffect } from 'react';
import { PreferencesSidebar } from './PreferencesSidebar';
import { ThemeSection } from './ThemeSection';
import { FavoritesSection } from './FavoritesSection';
import { ProjectsSection } from './ProjectsSection';
import { ControlNotesSection } from './ControlNotesSection';
import { RecentlyViewedSection } from './RecentlyViewedSection';
import { SavedViewsSection } from './SavedViewsSection';
import { ProvidersSection } from './ProvidersSection';
import { AiDataSection } from './AiDataSection';
import { NavigationSection } from './NavigationSection';
import { FilterPresetsSection } from './FilterPresetsSection';
import { StorageSection } from './StorageSection';
import { WhiteboardSection } from './WhiteboardSection';
import { GrcLankerSection } from './GrcLankerSection';

interface FrameworkInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  type: 'framework' | 'risk-list';
  tags?: string[];
}

interface PreferencesPageProps {
  frameworkConfigs: Record<string, FrameworkInfo>;
}

export function PreferencesPage({ frameworkConfigs }: PreferencesPageProps) {
  // Scroll to hash anchor after hydration
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      // Slight delay to let sections render
      requestAnimationFrame(() => {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }, []);

  return (
    <div className="flex gap-8">
      <PreferencesSidebar />

      <div className="flex-1 min-w-0 space-y-12">
        <ThemeSection />
        <hr className="border-border" />
        <FavoritesSection frameworkConfigs={frameworkConfigs} />
        <hr className="border-border" />
        <ProjectsSection />
        <hr className="border-border" />
        <ControlNotesSection />
        <hr className="border-border" />
        <RecentlyViewedSection />
        <hr className="border-border" />
        <SavedViewsSection />
        <hr className="border-border" />
        <WhiteboardSection />
        <hr className="border-border" />
        <ProvidersSection />
        <hr className="border-border" />
        <AiDataSection />
        <hr className="border-border" />
        <GrcLankerSection />
        <hr className="border-border" />
        <NavigationSection />
        <hr className="border-border" />
        <FilterPresetsSection />
        <hr className="border-border" />
        <StorageSection />
      </div>
    </div>
  );
}
