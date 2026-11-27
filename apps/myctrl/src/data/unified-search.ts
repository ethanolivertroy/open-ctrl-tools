/**
 * Unified search index generator for the /search page.
 * Combines controls, frameworks, technology guides, crosswalks, and static pages
 * into a single searchable index.
 */

import type {
  UnifiedSearchEntry,
  ControlSearchEntry,
  FrameworkSearchEntry,
  GuideSearchEntry,
  CrosswalkSearchEntry,
  PageSearchEntry,
} from './types';
import { generateAllSearchIndex, getAllFrameworkIds, getFrameworkConfig } from './controls';
import { getAllTechnologyGuides, getTechnologyPath } from './technology-guides';
import { CROSSWALK_CATALOG } from './crosswalk';

let _cache: UnifiedSearchEntry[] | null = null;

export function generateUnifiedSearchIndex(): UnifiedSearchEntry[] {
  if (_cache) return _cache;

  const entries: UnifiedSearchEntry[] = [];

  // 1. Controls (~22k)
  const controlEntries = generateAllSearchIndex();
  for (const entry of controlEntries) {
    const config = getFrameworkConfig(entry.frameworkId);
    entries.push({
      type: 'control',
      id: entry.id,
      title: entry.title,
      family: entry.family,
      description: entry.description,
      baselines: entry.baselines,
      href: entry.href,
      frameworkId: entry.frameworkId,
      tags: config.tags || [],
    } satisfies ControlSearchEntry);
  }

  // 2. Frameworks
  const frameworkIds = getAllFrameworkIds();
  for (const id of frameworkIds) {
    const config = getFrameworkConfig(id);
    if (config.tags?.includes('TBD')) continue;

    const basePath = config.type === 'risk-list' ? '/risk-lists' : '/frameworks';
    entries.push({
      type: 'framework',
      frameworkId: id,
      title: `${config.name} ${config.version}`,
      description: config.description,
      href: `${basePath}/${id}`,
      controlCount: 0, // Filled at build time, controls aren't loaded yet for count
      version: config.version,
      tags: config.tags || [],
    } satisfies FrameworkSearchEntry);
  }

  // 3. Technology Guides (parent guides + section subpages)
  const guides = getAllTechnologyGuides();
  for (const guide of guides) {
    const guidePath = getTechnologyPath(guide);
    entries.push({
      type: 'guide',
      title: guide.name,
      description: guide.description,
      href: guidePath,
      category: guide.category,
      vendor: guide.vendor,
      tags: [guide.category],
    } satisfies GuideSearchEntry);

    // Index individual sections so users can search for e.g. "EC2 FedRAMP RSC"
    if (guide.sections) {
      for (const section of guide.sections) {
        entries.push({
          type: 'guide',
          title: `${guide.name} — ${section.title}`,
          description: section.description,
          href: `${guidePath}/${section.id}`,
          category: guide.category,
          vendor: guide.vendor,
          tags: [guide.category],
        } satisfies GuideSearchEntry);
      }
    }
  }

  // 4. Crosswalks (catalog shared with the crosswalk registry)
  for (const catalogEntry of CROSSWALK_CATALOG) {
    entries.push({
      type: 'crosswalk',
      title: catalogEntry.title,
      description: catalogEntry.description,
      href: catalogEntry.href,
      fromFramework: catalogEntry.fromId,
      toFramework: catalogEntry.toId,
      tags: catalogEntry.tags,
    } satisfies CrosswalkSearchEntry);
  }

  // 5. Static pages
  const pages: PageSearchEntry[] = [
    { type: 'page', title: 'Compare Frameworks', description: 'Compare security and compliance frameworks side-by-side', href: '/compare', tags: [] },
    { type: 'page', title: 'Compare Controls', description: 'Compare controls across multiple frameworks side-by-side', href: '/compare/controls', tags: [] },
    { type: 'page', title: 'Knowledge Graph', description: 'Interactive force-directed graph of framework relationships', href: '/graph', tags: [] },
    { type: 'page', title: 'Preferences', description: 'Manage theme, favorites, notes, and all stored data', href: '/preferences', tags: [] },
    { type: 'page', title: 'Crosswalk Explorer', description: 'Browse cross-framework control mappings', href: '/crosswalk', tags: [] },
    { type: 'page', title: 'CMVP Explorer', description: 'Search CMVP cryptographic modules, certificates, standards, and algorithms', href: '/cmvp', tags: ['Federal', 'Cryptography'] },
    { type: 'page', title: 'Technology Guidance', description: 'Technology-specific security implementation guidance', href: '/guidance', tags: [] },
    { type: 'page', title: 'Developers', description: 'Developer hub for API keys, API references, and integration resources', href: '/developers', tags: ['Developers'] },
    { type: 'page', title: 'API Reference', description: 'Authenticated REST API endpoint documentation for myctrl.tools', href: '/developers/api', tags: ['Developers', 'API'] },
    { type: 'page', title: 'All Frameworks', description: 'Browse all security and compliance frameworks', href: '/all', tags: [] },
    { type: 'page', title: 'US Federal Frameworks', description: 'NIST, FedRAMP, CMMC, and other US federal security frameworks', href: '/us-federal', tags: ['Federal'] },
    { type: 'page', title: 'AI Frameworks', description: 'AI risk management and governance frameworks', href: '/ai', tags: ['AI'] },
    { type: 'page', title: 'Enterprise Frameworks', description: 'PCI-DSS, SOC 2, ISO 27001, and enterprise compliance frameworks', href: '/enterprise', tags: ['Enterprise'] },
    { type: 'page', title: 'Privacy Frameworks', description: 'HIPAA, GDPR, CCPA, and privacy regulation frameworks', href: '/privacy', tags: ['Privacy'] },
    { type: 'page', title: 'International Frameworks', description: 'Global security frameworks from Australia, Canada, UK, EU, and more', href: '/international', tags: ['International'] },
    { type: 'page', title: 'OWASP Risk Lists', description: 'OWASP Top 10 for Web, API, Mobile, LLM, and Smart Contract applications', href: '/owasp', tags: ['OWASP'] },
    { type: 'page', title: 'Meta-Frameworks', description: 'Comprehensive control frameworks like Adobe CCF, HITRUST, and CSA CCM', href: '/meta', tags: [] },
  ];
  entries.push(...pages);

  _cache = entries;
  return entries;
}
