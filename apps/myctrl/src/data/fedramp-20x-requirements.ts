/**
 * FedRAMP FRMR Requirements — MUST/SHOULD/MAY requirement lookup for KSIs.
 *
 * Maps KSI IDs (AFR family) to FRMR process requirements.
 * KSI-AFR-ADS → process ADS, KSI-AFR-CCM → process CCM, etc.
 * Generic KSI requirements live under the "KSI" process code.
 *
 * Data sourced from FRMR.documentation.json FRR section (20x + both scopes).
 */

import requirementsData from './fedramp-20x-requirements.json';

export interface FRMRRequirement {
  id: string;
  name: string;
  statement: string;
  keyword: 'MUST' | 'MUST NOT' | 'SHOULD' | 'SHOULD NOT' | 'MAY' | string;
  affects: string[];
  terms: string[];
  scope: '20x' | 'both';
  followingInformation?: string[];
  notes?: string[];
  variesByLevel?: Record<string, any>;
}

export interface ProcessRequirements {
  processCode: string;
  requirements: FRMRRequirement[];
  counts: {
    MUST: number;
    'MUST NOT': number;
    SHOULD: number;
    'SHOULD NOT': number;
    MAY: number;
  };
}

/**
 * Extract the FRMR process code from a KSI ID.
 * KSI-AFR-ADS → 'ADS', KSI-IAM-MFA → 'MFA'
 */
export function ksiIdToProcessCode(ksiId: string): string {
  const parts = ksiId.split('-');
  return parts[parts.length - 1];
}

/** Get FRMR requirements for a KSI (returns process-level requirements + generic KSI requirements). */
export function getKSIRequirements(ksiId: string): ProcessRequirements | undefined {
  const processCode = ksiIdToProcessCode(ksiId);
  const processes = (requirementsData as any).processes as Record<string, any>;

  const processData = processes[processCode];
  if (!processData) return undefined;

  // Also include generic KSI-level requirements
  const ksiGeneric = processes['KSI'];
  if (ksiGeneric && processCode !== 'KSI') {
    const combined: ProcessRequirements = {
      processCode,
      requirements: [...processData.requirements, ...ksiGeneric.requirements],
      counts: {
        MUST: processData.counts.MUST + (ksiGeneric.counts.MUST || 0),
        'MUST NOT': processData.counts['MUST NOT'] + (ksiGeneric.counts['MUST NOT'] || 0),
        SHOULD: processData.counts.SHOULD + (ksiGeneric.counts.SHOULD || 0),
        'SHOULD NOT': processData.counts['SHOULD NOT'] + (ksiGeneric.counts['SHOULD NOT'] || 0),
        MAY: processData.counts.MAY + (ksiGeneric.counts.MAY || 0),
      },
    };
    return combined;
  }

  return processData as ProcessRequirements;
}

/** Check if a KSI has FRMR requirements. */
export function hasKSIRequirements(ksiId: string): boolean {
  const processCode = ksiIdToProcessCode(ksiId);
  const processes = (requirementsData as any).processes as Record<string, any>;
  return processCode in processes;
}
