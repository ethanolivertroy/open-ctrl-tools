/**
 * Shared utilities for rendering framework and control data as Markdown.
 * Used by llms.txt, llms-full.txt, and per-framework .md endpoints.
 */

import {
  getAllFrameworkIds,
  getFrameworkConfig,
  getAllControls,
  getAllFamilies,
  getControlsByFamily,
  getBasePath,
} from '@/data/controls';
import {
  getFrameworkData,
  getFrameworks,
  getRiskLists,
  hasFrameworkData,
} from '@/data/frameworks';
import {
  CROSSWALK_REGISTRY,
  hasFrameworkCrosswalk,
  getFrameworkCrosswalkTargets,
} from '@/data/crosswalk';
import {
  TECHNOLOGY_CATEGORIES,
  getTechnologiesByCategory,
} from '@/data/technology-guides';

const SITE_URL = 'https://myctrl.tools';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function licenseLabel(license: string): string {
  switch (license) {
    case 'public-domain': return 'Public Domain';
    case 'open-license': return 'Open License';
    case 'cc-by-nd':
    case 'cc-by-nd-4.0': return 'CC BY-ND 4.0';
    case 'cc-by-nc-sa': return 'CC BY-NC-SA 4.0';
    case 'cc-by-4.0': return 'CC BY 4.0';
    case 'proprietary': return 'Proprietary';
    default: return license;
  }
}

/** Get non-TBD frameworks sorted by name */
function getActiveFrameworks() {
  return getFrameworks()
    .filter(c => !c.tags?.includes('TBD'))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Get non-TBD risk lists sorted by name */
function getActiveRiskLists() {
  return getRiskLists()
    .filter(c => !c.tags?.includes('TBD'))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function controlCount(frameworkId: string): number {
  try {
    return getAllControls(frameworkId).length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Per-framework full markdown (for /frameworks/{slug}.md)
// ---------------------------------------------------------------------------

export function renderFrameworkMarkdown(frameworkId: string): string {
  const config = getFrameworkConfig(frameworkId);
  const loaded = hasFrameworkData(frameworkId);
  const data = getFrameworkData(frameworkId);
  const controls = getAllControls(frameworkId);
  const families = getAllFamilies(frameworkId);
  const basePath = getBasePath(frameworkId);

  const lines: string[] = [];

  // Header
  lines.push(`# ${config.name}${config.version ? ` (${config.version})` : ''}`);
  lines.push('');
  lines.push(`> ${config.description}`);
  lines.push('');

  // Metadata
  if (config.dataSource) {
    lines.push(`- **Data Source:** ${config.dataSource.name}${config.dataSource.version ? ` ${config.dataSource.version}` : ''}`);
  }
  lines.push(`- **License:** ${licenseLabel(config.license)}`);
  if (config.officialUrl) {
    lines.push(`- **Official URL:** ${config.officialUrl}`);
  }
  if (loaded) {
    lines.push(`- **${config.itemLabel.charAt(0).toUpperCase() + config.itemLabel.slice(1)}:** ${controls.length}`);
  } else {
    lines.push(`- **Availability:** External reference (not redistributed; visit official source or load a licensed copy locally at \`src/data/local/${frameworkId}.json\` using \`skills/myctrl-local-standards/SKILL.md\`)`);
  }
  if (config.tags?.length) {
    lines.push(`- **Categories:** ${config.tags.filter(t => t !== 'TBD').join(', ')}`);
  }
  lines.push(`- **Browse:** ${SITE_URL}${basePath}/${frameworkId}`);
  lines.push('');

  // Families with control tables
  if (loaded && families.length > 0) {
    lines.push(`## ${config.familyLabel === 'Family' ? 'Families' : config.familyLabel + 's'}`);
    lines.push('');

    for (const family of families) {
      const familyControls = getControlsByFamily(frameworkId, family);
      const familyName = data.families?.[family] || family;
      const displayName = familyName !== family ? `${familyName} (${family})` : family;

      lines.push(`### ${displayName} — ${familyControls.length} ${config.itemLabel}`);
      lines.push('');
      lines.push(`| ID | Title |`);
      lines.push(`|----|-------|`);

      for (const control of familyControls) {
        // Escape pipes in titles
        const title = (control.title || '').replace(/\|/g, '\\|');
        lines.push(`| ${control.control_id} | ${title} |`);
      }

      lines.push('');
    }
  }

  // Crosswalk info
  if (hasFrameworkCrosswalk(frameworkId)) {
    const targets = getFrameworkCrosswalkTargets(frameworkId);
    if (targets.length > 0) {
      lines.push('## Cross-Framework Mappings');
      lines.push('');
      const targetNames = targets.map(t => {
        try {
          return getFrameworkConfig(t).name;
        } catch {
          return t;
        }
      });
      lines.push(`This framework has mappings to: ${targetNames.join(', ')}.`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Compact framework summary (for llms-full.txt)
// ---------------------------------------------------------------------------

export function renderFrameworkSummary(frameworkId: string): string {
  const config = getFrameworkConfig(frameworkId);
  const loaded = hasFrameworkData(frameworkId);
  const data = getFrameworkData(frameworkId);
  const controls = getAllControls(frameworkId);
  const families = getAllFamilies(frameworkId);

  const lines: string[] = [];

  lines.push(`## ${config.name}${config.version ? ` (${config.version})` : ''}`);
  lines.push('');
  lines.push(config.description);
  const countPart = loaded ? `${controls.length} ${config.itemLabel}` : 'External reference (load locally)';
  lines.push(`${countPart} | ${licenseLabel(config.license)}${config.tags?.length ? ` | Tags: ${config.tags.filter(t => t !== 'TBD').join(', ')}` : ''}`);
  if (config.officialUrl) {
    lines.push(`Official: ${config.officialUrl}`);
  }

  // Family summary (just names and counts, no control tables)
  if (loaded && families.length > 0) {
    const familySummaries = families.map(f => {
      const name = data.families?.[f] || f;
      const count = getControlsByFamily(frameworkId, f).length;
      return `${name} (${count})`;
    });
    lines.push(`Families: ${familySummaries.join(', ')}`);
  }

  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// llms.txt index
// ---------------------------------------------------------------------------

export function renderLlmsTxt(): string {
  const frameworks = getActiveFrameworks();
  const riskLists = getActiveRiskLists();

  const lines: string[] = [];

  // H1 + summary blockquote (required by spec)
  lines.push('# myctrl.tools');
  lines.push('');
  lines.push('> Browse and compare 80+ built-in public-domain and open-license security frameworks, plus official source references and BYO local overlay support for commercial standards.');
  lines.push('');

  // Detail paragraph
  lines.push('myctrl.tools is a searchable, static reference for security engineers and GRC professionals. Built-in control catalogs ship exclusively from U.S. federal, state, international public-domain, and permissive open-license publications. Copyrighted and restricted standards forward to their official sources and can be loaded locally via `src/data/local/`.');
  lines.push('');

  // Frameworks section
  lines.push('## Frameworks');
  lines.push('');
  for (const fw of frameworks) {
    const count = controlCount(fw.id);
    const countLabel = hasFrameworkData(fw.id) && count > 0
      ? `: ${count} ${fw.itemLabel}`
      : ' (external reference · load locally)';
    lines.push(`- [${fw.name}](${SITE_URL}/frameworks/${fw.id}.md)${countLabel} — ${fw.description}`);
  }
  lines.push('');

  // Risk Lists section
  if (riskLists.length > 0) {
    lines.push('## Risk Lists');
    lines.push('');
    for (const rl of riskLists) {
      const count = controlCount(rl.id);
      const countLabel = count > 0 ? `: ${count} ${rl.itemLabel}` : '';
      lines.push(`- [${rl.name}](${SITE_URL}/risk-lists/${rl.id}.md)${countLabel} — ${rl.description}`);
    }
    lines.push('');
  }

  // Features section
  lines.push('## Features');
  lines.push('');
  lines.push(`- [Cross-Framework Mappings](${SITE_URL}/crosswalk.md): Browse mappings between frameworks (NIST ↔ CSF, AI RMF ↔ ISO 42001, etc.)`);
  lines.push(`- [Technology Guidance](${SITE_URL}/guidance.md): Implementation guidance with verification commands for IAM, cloud, containers, DevSecOps, and AI platforms`);
  lines.push(`- [Framework Comparison](${SITE_URL}/compare.md): Side-by-side framework comparison tool`);
  lines.push('');

  // Optional section (secondary info)
  lines.push('## Optional');
  lines.push('');
  lines.push(`- [API Documentation](${SITE_URL}/api-docs.md): Authenticated REST API for programmatic access to all framework and control data`);
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// llms-full.txt (framework summaries only, no individual controls)
// ---------------------------------------------------------------------------

export function renderLlmsFullTxt(): string {
  const allIds = getAllFrameworkIds();
  const activeIds = allIds.filter(id => {
    try {
      const config = getFrameworkConfig(id);
      return !config.tags?.includes('TBD');
    } catch {
      return false;
    }
  });

  const lines: string[] = [];

  // Header
  lines.push('# myctrl.tools — Full Documentation');
  lines.push('');
  lines.push('> Complete framework catalog for LLM consumption. For individual control listings, see the per-framework markdown files linked from llms.txt.');
  lines.push('');
  lines.push('myctrl.tools is a searchable, static reference for security engineers and GRC professionals. It covers US Federal, international, AI/ML, privacy, and enterprise frameworks with cross-framework mappings and technology-specific implementation guidance.');
  lines.push('');
  lines.push('---');
  lines.push('');

  // Each framework summary
  for (const id of activeIds) {
    try {
      lines.push(renderFrameworkSummary(id));
    } catch {
      // Skip frameworks that fail to load
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Crosswalk summary markdown
// ---------------------------------------------------------------------------

export function renderCrosswalkMarkdown(): string {
  const lines: string[] = [];

  lines.push('# Cross-Framework Mappings');
  lines.push('');
  lines.push('> Browse and navigate mappings between security and compliance frameworks.');
  lines.push('');
  lines.push(`Browse interactively: ${SITE_URL}/crosswalk`);
  lines.push(`Visualize relationships: ${SITE_URL}/crosswalk/visualize`);
  lines.push('');
  lines.push('## Available Mapping Pairs');
  lines.push('');
  lines.push('| Source Framework | Target Framework |');
  lines.push('|-----------------|-----------------|');

  for (const pair of CROSSWALK_REGISTRY) {
    let nameA = pair.aName;
    let nameB = pair.bName;
    try { nameA = getFrameworkConfig(pair.a).name; } catch { /* keep registry name */ }
    try { nameB = getFrameworkConfig(pair.b).name; } catch { /* keep registry name */ }
    lines.push(`| ${nameA} | ${nameB} |`);
  }

  lines.push('');
  lines.push('All mappings are bidirectional — you can navigate from either framework to the other.');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Technology guidance summary markdown
// ---------------------------------------------------------------------------

export function renderGuidanceMarkdown(): string {
  const lines: string[] = [];

  lines.push('# Technology Guidance');
  lines.push('');
  lines.push('> Security implementation and testing guidance organized by domain. Each guide aggregates authoritative sources with practical verification commands.');
  lines.push('');
  lines.push(`Browse interactively: ${SITE_URL}/guidance`);
  lines.push('');

  for (const category of TECHNOLOGY_CATEGORIES) {
    if (!category.path) continue;
    const techs = getTechnologiesByCategory(category.id);

    lines.push(`## ${category.name}`);
    lines.push('');
    lines.push(category.description);
    lines.push('');

    if (techs.length > 0) {
      for (const tech of techs) {
        lines.push(`- **${tech.name}** (${tech.vendor}): ${tech.description}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Compare page markdown
// ---------------------------------------------------------------------------

export function renderCompareMarkdown(): string {
  return `# Framework Comparison

> Side-by-side comparison of security and compliance frameworks.

Compare interactively: ${SITE_URL}/compare

The comparison tool lets you select two or more frameworks and view them side-by-side, comparing:

- **Control counts** and family structures
- **Scope and applicability** (who must comply)
- **Baselines and maturity levels** (where applicable)
- **Tags and categories** (Federal, AI, Privacy, Enterprise, International)

All ${getActiveFrameworks().length} frameworks and ${getActiveRiskLists().length} risk lists are available for comparison.
`;
}

// ---------------------------------------------------------------------------
// API docs markdown
// ---------------------------------------------------------------------------

export function renderApiDocsMarkdown(): string {
  return `# API Documentation

> Public read-only REST API for programmatic access to framework and control data.

Base URL: \`${SITE_URL}/api/v1\`

## Access

No API key, GitHub sign-in, or server-side account is required.

## Endpoints

### List Frameworks

\`GET /api/v1/frameworks\`

Query parameters:
- \`category\` — Filter by tag (e.g., \`Federal\`, \`AI\`, \`Privacy\`)
- \`limit\` — Results per page (1-200, default 50)
- \`cursor\` — Pagination cursor

Returns: Framework metadata including name, version, description, tags, control count, baselines, and canonical URL.

### Get Framework Details

\`GET /api/v1/frameworks/{slug}\`

Returns: Full framework metadata including families, baselines, and data source info.

### Get Control Details

\`GET /api/v1/controls/{frameworkSlug}/{controlId}\`

Returns: Control metadata, description, framework-specific fields, and cross-framework mappings.

### Search

\`GET /api/v1/search?q={query}\`

Query parameters:
- \`q\` — Search query (required)
- \`framework\` — Filter by framework slug
- \`limit\` — Results per page (default 20)

Returns: Matching controls and frameworks with relevance scoring.

### Crosswalk Mappings

\`GET /api/v1/crosswalks\`

Returns: Available cross-framework mapping pairs.

### Technology Guidance

\`GET /api/v1/guidance/{slug}\`

Returns: Technology-specific security guidance with verification commands.

User workspace data is not exposed through this API. Favorites, notes, assessments, whiteboards, and provider settings stay local to each browser through IndexedDB/Dexie.
`;
}
