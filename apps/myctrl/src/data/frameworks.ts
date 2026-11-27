import type { FrameworkData } from './types';

export {
  FRAMEWORK_CONFIGS,
  getAllFrameworkIds,
  getFrameworkConfig,
  isValidFramework,
  getFrameworks,
  getRiskLists,
  getByTag,
  isRiskList,
  getByLicense,
} from './framework-configs';
import { FRAMEWORK_CONFIGS } from './framework-configs';

/**
 * Built-in framework datasets (public-domain and permissive open-license)
 * merged with optional gitignored BYO local overlays in src/data/local/*.json.
 * Local overlays take precedence when both exist for the same framework id.
 */
const builtInModules = import.meta.glob('./*.json', {
  eager: true,
  import: 'default',
}) as Record<string, FrameworkData>;

const localModules = import.meta.glob('./local/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, FrameworkData>;

const FRAMEWORK_DATA: Record<string, FrameworkData> = {};
const LOCAL_FRAMEWORK_IDS = new Set<string>();
const EMPTY_FRAMEWORK_STUBS: Record<string, FrameworkData> = {};

for (const id of Object.keys(FRAMEWORK_CONFIGS)) {
  const localMod = localModules[`./local/${id}.json`];
  const builtInMod = builtInModules[`./${id}.json`];
  if (localMod) {
    FRAMEWORK_DATA[id] = localMod;
    LOCAL_FRAMEWORK_IDS.add(id);
  } else if (builtInMod) {
    FRAMEWORK_DATA[id] = builtInMod;
  }
}

/** Whether control dataset JSON is loaded (built-in or local overlay) */
export function hasFrameworkData(frameworkId: string): boolean {
  return frameworkId in FRAMEWORK_DATA;
}

/** Whether this framework's dataset was loaded from src/data/local/ */
export function isLocalFrameworkData(frameworkId: string): boolean {
  return LOCAL_FRAMEWORK_IDS.has(frameworkId);
}

/** Framework IDs that currently have loaded control datasets */
export function getLoadedFrameworkIds(): string[] {
  return Object.keys(FRAMEWORK_CONFIGS).filter((id) => hasFrameworkData(id));
}

/** Catalog framework IDs configured as external references without loaded JSON */
export function getExternalFrameworkIds(): string[] {
  return Object.keys(FRAMEWORK_CONFIGS).filter((id) => !hasFrameworkData(id));
}

/**
 * Get framework data by ID. Returns a cached empty FrameworkData stub for
 * external-only catalog frameworks so reference/crosswalk/UI callers can
 * inspect metadata safely without crashing.
 */
export function getFrameworkData(frameworkId: string): FrameworkData {
  const data = FRAMEWORK_DATA[frameworkId];
  if (data) {
    return data;
  }

  const config = FRAMEWORK_CONFIGS[frameworkId];
  if (!config) {
    throw new Error(`Unknown framework: ${frameworkId}`);
  }

  if (!EMPTY_FRAMEWORK_STUBS[frameworkId]) {
    EMPTY_FRAMEWORK_STUBS[frameworkId] = {
      framework: {
        id: config.id,
        name: config.name,
        version: config.version,
        description: config.description,
      },
      families: {},
      controls: [],
    };
  }

  return EMPTY_FRAMEWORK_STUBS[frameworkId];
}
