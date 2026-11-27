import type { Control, NistControl, Framework, SearchEntry, FrameworkSearchEntry, BaselineLevel, ImpactLevel, DoDImpactLevel, ImplementationGroup, SeverityLevel, ITSG33Profile, CISControl, CMMCLevel, EURiskTier, TXRAMPLevel } from './types';
import { isNistControl, isFedRampKSIControl, isCISControl, isFedRAMPControl, isDoDSRGControl, isSTIGControl, isITSG33Control, isCMMCControl, isEUAIActControl, isTXRAMPControl, isGovRAMPControl } from './types';
import { getFrameworkData, getFrameworkConfig, getAllFrameworkIds, isRiskList, getFrameworks, getRiskLists } from './frameworks';
import { normalizeControlId } from '@/lib/search/control-id';
import { slugifyControlId } from '@/lib/slugify';

// Cache processed controls per framework
const _controlsCache: Record<string, Control[]> = {};

/**
 * Convert control ID to URL-safe slug (canonical implementation in
 * @/lib/slugify, re-exported here under the data layer's historical name).
 */
export const slugify = slugifyControlId;

/**
 * Get the base path for a framework or risk list
 */
export function getBasePath(frameworkId: string): string {
  return isRiskList(frameworkId) ? '/risk-lists' : '/frameworks';
}

/**
 * Get all controls for a framework
 */
export function getAllControls(frameworkId: string): Control[] {
  if (_controlsCache[frameworkId]) return _controlsCache[frameworkId];

  const data = getFrameworkData(frameworkId);
  const basePath = getBasePath(frameworkId);
  _controlsCache[frameworkId] = data.controls.map(c => ({
    ...c,
    url: `${basePath}/${frameworkId}/${slugify(c.control_id)}`,
  }));

  return _controlsCache[frameworkId];
}

/**
 * Get a single control by its slug
 */
export function getControlBySlug(frameworkId: string, slug: string): Control | undefined {
  return getAllControls(frameworkId).find(c => slugify(c.control_id) === slug);
}

/**
 * Get a single control by its ID
 */
export function getControlById(frameworkId: string, id: string): Control | undefined {
  return getAllControls(frameworkId).find(c => c.control_id === id);
}

/**
 * Get all controls for a specific family
 */
export function getControlsByFamily(frameworkId: string, family: string): Control[] {
  return getAllControls(frameworkId).filter(c => c.family === family);
}

/**
 * Get all unique family abbreviations for a framework
 */
export function getAllFamilies(frameworkId: string): string[] {
  const families = new Set(getAllControls(frameworkId).map(c => c.family));
  // Sort numerically for PCI-DSS (1, 2, 3...) and alphabetically for NIST (AC, AT, AU...)
  return Array.from(families).sort((a, b) => {
    const aNum = parseInt(a);
    const bNum = parseInt(b);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    return a.localeCompare(b);
  });
}

/**
 * Get family full name from abbreviation
 */
export function getFamilyName(frameworkId: string, abbreviation: string): string {
  const data = getFrameworkData(frameworkId);
  return data.families[abbreviation] || abbreviation;
}

/**
 * Get controls by baseline level (NIST 800-53 and FedRAMP Rev 5)
 */
export function getControlsByBaseline(frameworkId: string, level: BaselineLevel): Control[] {
  const config = getFrameworkConfig(frameworkId);
  if (!config.hasBaselines) {
    return [];
  }

  return getAllControls(frameworkId).filter(c => {
    // NIST 800-53 (flat boolean properties)
    if (isNistControl(c)) {
      switch (level) {
        case 'LOW': return c.baseline_low;
        case 'MODERATE': return c.baseline_moderate;
        case 'HIGH': return c.baseline_high;
        case 'PRIVACY': return c.baseline_privacy;
      }
    }
    // FedRAMP Rev 5 (nested baselines structure)
    if (isFedRAMPControl(c)) {
      switch (level) {
        case 'LI_SAAS': return c.baselines.li_saas?.included;
        case 'LOW': return c.baselines.low?.included;
        case 'MODERATE': return c.baselines.moderate?.included;
        case 'HIGH': return c.baselines.high?.included;
        default: return false; // FedRAMP doesn't have PRIVACY
      }
    }
    // GovRAMP (Low/Moderate baselines)
    if (isGovRAMPControl(c)) {
      switch (level) {
        case 'LOW': return c.baselines.low?.included;
        case 'MODERATE': return c.baselines.moderate?.included;
        default: return false;
      }
    }
    return false;
  });
}

/**
 * Get controls by impact level (FedRAMP KSI only)
 */
export function getControlsByImpactLevel(frameworkId: string, level: ImpactLevel): Control[] {
  const config = getFrameworkConfig(frameworkId);
  if (!config.hasImpactLevels) {
    return [];
  }

  return getAllControls(frameworkId).filter(c => {
    if (!isFedRampKSIControl(c)) return false;
    switch (level) {
      case 'LOW': return c.impact_low;
      case 'MODERATE': return c.impact_moderate;
    }
  });
}

/**
 * Get controls by DoD Impact Level (DoD SRG only)
 */
export function getControlsByDoDImpactLevel(frameworkId: string, level: DoDImpactLevel): Control[] {
  if (frameworkId !== 'dod-srg') {
    return [];
  }

  return getAllControls(frameworkId).filter(c => {
    if (!isDoDSRGControl(c)) return false;
    switch (level) {
      case 'IL4_MOD': return c.impact_levels.il4_mod?.included;
      case 'IL4_HIGH': return c.impact_levels.il4_high?.included;
      case 'IL5': return c.impact_levels.il5?.included;
      case 'IL6': return c.impact_levels.il6?.included;
      default: return false;
    }
  });
}

/**
 * Get controls by implementation group (CIS Controls only)
 */
export function getControlsByIG(frameworkId: string, level: ImplementationGroup): Control[] {
  const config = getFrameworkConfig(frameworkId);
  if (!config.hasImplementationGroups) {
    return [];
  }

  return getAllControls(frameworkId).filter(c => {
    if (!isCISControl(c)) return false;
    switch (level) {
      case 'IG1': return c.ig1;
      case 'IG2': return c.ig2;
      case 'IG3': return c.ig3;
    }
  });
}

/**
 * Get controls by severity level (STIGs only)
 */
export function getControlsBySeverity(frameworkId: string, level: SeverityLevel): Control[] {
  const config = getFrameworkConfig(frameworkId);
  if (!config.hasSeverityLevels) {
    return [];
  }

  return getAllControls(frameworkId).filter(c => {
    if (!isSTIGControl(c)) return false;
    switch (level) {
      case 'CAT_I': return c.severity === 'high';
      case 'CAT_II': return c.severity === 'medium';
      case 'CAT_III': return c.severity === 'low';
    }
  });
}

/**
 * Get controls by ITSG-33 profile (Canadian Government)
 */
export function getControlsByITSG33Profile(frameworkId: string, profile: ITSG33Profile): Control[] {
  if (frameworkId !== 'itsg-33') {
    return [];
  }

  return getAllControls(frameworkId).filter(c => {
    if (!isITSG33Control(c)) return false;
    switch (profile) {
      case 'PBMM': return c.profiles.pbmm?.included;
      case 'SECRET': return c.profiles.secret?.included;
      default: return false;
    }
  });
}

/**
 * Get controls by CMMC level (CMMC only)
 */
export function getControlsByCMMCLevel(frameworkId: string, level: CMMCLevel): Control[] {
  const config = getFrameworkConfig(frameworkId);
  if (!config.hasCMMCLevels) {
    return [];
  }

  return getAllControls(frameworkId).filter(c => {
    if (!isCMMCControl(c)) return false;
    return c.cmmc_level === level;
  });
}

/**
 * Get controls by EU AI Act risk tier
 */
export function getControlsByRiskTier(frameworkId: string, tier: EURiskTier): Control[] {
  const config = getFrameworkConfig(frameworkId);
  if (!config.hasRiskTiers) {
    return [];
  }

  return getAllControls(frameworkId).filter(c => {
    if (!isEUAIActControl(c)) return false;
    return c.risk_tier === tier;
  });
}

/**
 * Get controls by TX-RAMP level (TX-RAMP only)
 */
export function getControlsByTXRAMPLevel(frameworkId: string, level: TXRAMPLevel): Control[] {
  const config = getFrameworkConfig(frameworkId);
  if (!config.hasTXRAMPLevels) {
    return [];
  }

  return getAllControls(frameworkId).filter(c => {
    if (!isTXRAMPControl(c)) return false;
    switch (level) {
      case 'LEVEL1': return c.level1;
      case 'LEVEL2': return c.level2;
    }
  });
}

/**
 * Get baselines as array for a control (NIST only)
 */
export function getBaselines(control: Control): BaselineLevel[] {
  if (isNistControl(control)) {
    const baselines: BaselineLevel[] = [];
    if (control.baseline_low) baselines.push('LOW');
    if (control.baseline_moderate) baselines.push('MODERATE');
    if (control.baseline_high) baselines.push('HIGH');
    if (control.baseline_privacy) baselines.push('PRIVACY');
    return baselines;
  }
  if (isGovRAMPControl(control)) {
    const baselines: BaselineLevel[] = [];
    if (control.baselines.low?.included) baselines.push('LOW');
    if (control.baselines.moderate?.included) baselines.push('MODERATE');
    return baselines;
  }
  return [];
}

/**
 * Get implementation groups as array for a control (CIS only)
 */
export function getImplementationGroups(control: Control): ImplementationGroup[] {
  if (!isCISControl(control)) {
    return [];
  }
  const igs: ImplementationGroup[] = [];
  if (control.ig1) igs.push('IG1');
  if (control.ig2) igs.push('IG2');
  if (control.ig3) igs.push('IG3');
  return igs;
}

/**
 * Get framework metadata
 */
export function getFramework(frameworkId: string): Framework {
  const data = getFrameworkData(frameworkId);
  const controls = getAllControls(frameworkId);
  const families = getAllFamilies(frameworkId);

  return {
    id: data.framework.id,
    name: data.framework.name,
    version: data.framework.version,
    description: data.framework.description,
    control_count: controls.length,
    families,
  };
}

/**
 * Generate search index for a framework
 */
export function generateSearchIndex(frameworkId: string): SearchEntry[] {
  const config = getFrameworkConfig(frameworkId);
  return getAllControls(frameworkId).map(c => {
    // Get baselines/IGs depending on framework type
    let baselines: string[] = [];
    if (config.hasBaselines) {
      baselines = getBaselines(c);
    } else if (config.hasImplementationGroups) {
      baselines = getImplementationGroups(c);
    }

    return {
      id: c.control_id,
      title: `${c.control_id}: ${c.title}`,
      family: c.family,
      description: c.description.substring(0, 200),
      baselines,
      href: c.url!,
      frameworkId,
    };
  });
}

/**
 * Generate search index for all frameworks
 */
export function generateAllSearchIndex(): SearchEntry[] {
  return getAllFrameworkIds().flatMap(id => generateSearchIndex(id));
}

/**
 * Generate search index entries for all frameworks (for framework discoverability)
 */
export function generateFrameworkSearchIndex(): FrameworkSearchEntry[] {
  const allConfigs = [...getFrameworks(), ...getRiskLists()];

  return allConfigs
    .filter(c => !c.tags?.includes('TBD'))
    .map((config): FrameworkSearchEntry => ({
      type: 'framework',
      frameworkId: config.id,
      title: config.name,
      description: config.description,
      version: config.version,
      tags: config.tags || [],
      controlCount: getAllControls(config.id).length,
      href: config.type === 'risk-list'
        ? `/risk-lists/${config.id}`
        : `/frameworks/${config.id}`,
    }));
}

/**
 * Get statistics for a framework
 */
export function getStats(frameworkId: string) {
  const controls = getAllControls(frameworkId);
  const config = getFrameworkConfig(frameworkId);

  const stats: {
    total: number;
    families: number;
    li_saas?: number;
    low?: number;
    moderate?: number;
    high?: number;
    privacy?: number;
    ig1?: number;
    ig2?: number;
    ig3?: number;
    il4_mod?: number;
    il4_high?: number;
    il5?: number;
    il6?: number;
    cat_i?: number;
    cat_ii?: number;
    cat_iii?: number;
    pbmm?: number;
    secret?: number;
    level1?: number;
    level2?: number;
    level3?: number;
    // EU AI Act risk tiers
    prohibited?: number;
    high_risk?: number;
    limited_risk?: number;
    minimal_risk?: number;
    gpai?: number;
    // TX-RAMP levels
    tx_level1?: number;
    tx_level2?: number;
  } = {
    total: controls.length,
    families: getAllFamilies(frameworkId).length,
  };

  // Only include baseline stats for frameworks that have them
  if (config.hasBaselines) {
    // NIST 800-53 controls (flat boolean properties)
    if (frameworkId === 'nist-800-53-r5') {
      stats.low = controls.filter(c => isNistControl(c) && c.baseline_low).length;
      stats.moderate = controls.filter(c => isNistControl(c) && c.baseline_moderate).length;
      stats.high = controls.filter(c => isNistControl(c) && c.baseline_high).length;
      stats.privacy = controls.filter(c => isNistControl(c) && c.baseline_privacy).length;
    }
    // FedRAMP Rev 5 controls (nested baselines structure)
    else if (frameworkId === 'fedramp-rev5') {
      stats.li_saas = controls.filter(c => isFedRAMPControl(c) && c.baselines.li_saas?.included).length;
      stats.low = controls.filter(c => isFedRAMPControl(c) && c.baselines.low?.included).length;
      stats.moderate = controls.filter(c => isFedRAMPControl(c) && c.baselines.moderate?.included).length;
      stats.high = controls.filter(c => isFedRAMPControl(c) && c.baselines.high?.included).length;
    }
    // GovRAMP controls (Low/Moderate baselines)
    else if (frameworkId === 'govramp') {
      stats.low = controls.filter(c => isGovRAMPControl(c) && c.baselines.low?.included).length;
      stats.moderate = controls.filter(c => isGovRAMPControl(c) && c.baselines.moderate?.included).length;
    }
  }

  // Include impact level stats for FedRAMP KSI
  if (config.hasImpactLevels && frameworkId === 'fedramp-20x-ksi') {
    stats.low = controls.filter(c => isFedRampKSIControl(c) && c.impact_low).length;
    stats.moderate = controls.filter(c => isFedRampKSIControl(c) && c.impact_moderate).length;
  }

  // Include DoD SRG impact level stats
  if (frameworkId === 'dod-srg') {
    stats.il4_mod = controls.filter(c => isDoDSRGControl(c) && c.impact_levels.il4_mod?.included).length;
    stats.il4_high = controls.filter(c => isDoDSRGControl(c) && c.impact_levels.il4_high?.included).length;
    stats.il5 = controls.filter(c => isDoDSRGControl(c) && c.impact_levels.il5?.included).length;
    stats.il6 = controls.filter(c => isDoDSRGControl(c) && c.impact_levels.il6?.included).length;
  }

  // Include implementation group stats for CIS Controls
  if (config.hasImplementationGroups) {
    stats.ig1 = controls.filter(c => isCISControl(c) && c.ig1).length;
    stats.ig2 = controls.filter(c => isCISControl(c) && c.ig2).length;
    stats.ig3 = controls.filter(c => isCISControl(c) && c.ig3).length;
  }

  // Include severity stats for STIGs
  if (config.hasSeverityLevels) {
    stats.cat_i = controls.filter(c => isSTIGControl(c) && c.severity === 'high').length;
    stats.cat_ii = controls.filter(c => isSTIGControl(c) && c.severity === 'medium').length;
    stats.cat_iii = controls.filter(c => isSTIGControl(c) && c.severity === 'low').length;
  }

  // Include ITSG-33 profile stats
  if (frameworkId === 'itsg-33') {
    stats.pbmm = controls.filter(c => isITSG33Control(c) && c.profiles.pbmm?.included).length;
    stats.secret = controls.filter(c => isITSG33Control(c) && c.profiles.secret?.included).length;
  }

  // Include CMMC level stats
  if (config.hasCMMCLevels) {
    stats.level1 = controls.filter(c => isCMMCControl(c) && c.cmmc_level === 1).length;
    stats.level2 = controls.filter(c => isCMMCControl(c) && c.cmmc_level === 2).length;
    stats.level3 = controls.filter(c => isCMMCControl(c) && c.cmmc_level === 3).length;
  }

  // Include EU AI Act risk tier stats
  if (config.hasRiskTiers) {
    stats.prohibited = controls.filter(c => isEUAIActControl(c) && c.risk_tier === 'prohibited').length;
    stats.high_risk = controls.filter(c => isEUAIActControl(c) && c.risk_tier === 'high-risk').length;
    stats.limited_risk = controls.filter(c => isEUAIActControl(c) && c.risk_tier === 'limited-risk').length;
    stats.minimal_risk = controls.filter(c => isEUAIActControl(c) && c.risk_tier === 'minimal-risk').length;
    stats.gpai = controls.filter(c => isEUAIActControl(c) && c.risk_tier === 'gpai').length;
  }

  // Include TX-RAMP level stats
  if (config.hasTXRAMPLevels) {
    stats.tx_level1 = controls.filter(c => isTXRAMPControl(c) && c.level1).length;
    stats.tx_level2 = controls.filter(c => isTXRAMPControl(c) && c.level2).length;
  }

  return stats;
}

// === Neighbor Controls (for prev/next navigation) ===

export interface ControlNeighbor {
  controlId: string;
  title: string;
  url: string;
}

export interface ControlNeighbors {
  prev: ControlNeighbor | null;
  next: ControlNeighbor | null;
  prevFamily: ControlNeighbor | null;
  nextFamily: ControlNeighbor | null;
}

/**
 * Get neighboring controls for prev/next navigation.
 * Returns both all-controls and family-only neighbors.
 */
export function getNeighborControls(frameworkId: string, controlId: string): ControlNeighbors {
  const allControls = getAllControls(frameworkId);
  const currentIndex = allControls.findIndex(c => c.control_id === controlId);

  if (currentIndex === -1) {
    return { prev: null, next: null, prevFamily: null, nextFamily: null };
  }

  const toNeighbor = (c: Control): ControlNeighbor => ({
    controlId: c.control_id,
    title: c.title,
    url: c.url!,
  });

  // All-controls neighbors
  const prev = currentIndex > 0 ? toNeighbor(allControls[currentIndex - 1]) : null;
  const next = currentIndex < allControls.length - 1 ? toNeighbor(allControls[currentIndex + 1]) : null;

  // Family-only neighbors
  const currentFamily = allControls[currentIndex].family;
  const familyControls = allControls.filter(c => c.family === currentFamily);
  const familyIndex = familyControls.findIndex(c => c.control_id === controlId);
  const prevFamily = familyIndex > 0 ? toNeighbor(familyControls[familyIndex - 1]) : null;
  const nextFamily = familyIndex < familyControls.length - 1 ? toNeighbor(familyControls[familyIndex + 1]) : null;

  return { prev, next, prevFamily, nextFamily };
}

// Re-export framework functions for convenience
export {
  getAllFrameworkIds,
  getFrameworkConfig,
  isValidFramework,
  getFrameworks,
  getRiskLists,
  getByTag,
  isRiskList,
  getByLicense,
  hasFrameworkData,
  isLocalFrameworkData,
  getLoadedFrameworkIds,
  getExternalFrameworkIds,
} from './frameworks';
