/**
 * Crosswalk Auto-Fill Engine
 *
 * Generates control status suggestions for FedRAMP Rev 5 baselines using:
 * 1. Direct built-in public-domain alignments (NIST SP 800-53 Rev 5 -> FedRAMP,
 *    NIST CSF 2.0 -> NIST 800-53 -> FedRAMP, CMMC / NIST 800-171 where available)
 * 2. Optional local crosswalk overlays in src/data/local/crosswalks/
 *    (CJIS <-> FedRAMP and CCF bridge maps for SOC 2, PCI DSS, ISO 27001, CIS)
 *
 * Auto-fill NEVER suggests 'implemented'. FedRAMP has specific parameter
 * requirements beyond other frameworks, so we suggest 'partially-implemented'
 * (for full source compliance) or 'planned' (for partial).
 */

import type { ImplementationStatus } from './db';
import { getBaselineControlIds, type FedRampBaseline } from './assessment-scoring';
import { getLoadedBridgeData, getNistControlsForCSF } from '../data/crosswalk';
import { getFrameworkData } from '../data/frameworks';

// === Types ===

export interface CrosswalkMapping {
  fedrampControlId: string;
  sourceControlIds: string[];
  bridgeCcfIds?: string[];
  bridgeType: 'direct' | 'ccf-bridge';
}

export interface CrosswalkSuggestion {
  fedrampControlId: string;
  suggestedStatus: ImplementationStatus;
  confidence: 'high' | 'medium' | 'low';
  sourceFrameworkId: string;
  sourceControlIds: string[];
  bridgeType: 'direct' | 'ccf-bridge';
  reason: string;
}

export interface AutoFillSummary {
  sourceFrameworkId: string;
  sourceFrameworkName: string;
  complianceLevel: 'full' | 'partial';
  totalSuggestions: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  suggestions: CrosswalkSuggestion[];
}

export const CROSSWALK_SOURCE_FRAMEWORKS: { id: string; name: string }[] = [
  { id: 'nist-800-53-r5', name: 'NIST SP 800-53 Rev 5' },
  { id: 'soc2-tsc', name: 'SOC 2 TSC' },
  { id: 'nist-800-171-r2', name: 'NIST SP 800-171 Rev 2' },
  { id: 'pci-dss-v4', name: 'PCI DSS v4.0.1' },
  { id: 'cmmc-v2', name: 'CMMC v2.0' },
  { id: 'nist-csf-v2', name: 'NIST CSF 2.0' },
  { id: 'cis-controls-v8', name: 'CIS Controls v8' },
  { id: 'iso-27001-2022', name: 'ISO 27001:2022' },
  { id: 'cjis', name: 'FBI CJIS Security Policy' },
];

/** Canonicalize NIST 800-53 control IDs across "AC-2 (01)" vs "AC-2(1)" formatting */
function canonicalNistId(id: string): string {
  return id.replace(/\s+/g, '').replace(/\(0+(\d+)\)/g, '($1)').toUpperCase();
}

function getFedrampByCanonicalNistId(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const controls = getFrameworkData('fedramp-rev5').controls;
  for (const c of controls) {
    const canon = canonicalNistId(c.control_id);
    const list = map.get(canon) ?? [];
    list.push(c.control_id);
    map.set(canon, list);
  }
  return map;
}

export function getAvailableCrosswalkSourceFrameworks(): { id: string; name: string }[] {
  return CROSSWALK_SOURCE_FRAMEWORKS.filter((fw) => buildCrosswalkMappings(fw.id).length > 0);
}

/**
 * Build mappings from a source framework to FedRAMP Rev 5.
 */
export function buildCrosswalkMappings(sourceFrameworkId: string): CrosswalkMapping[] {
  const { frameworkToBridge, bridgeToFramework, cjisFedrampData } = getLoadedBridgeData();

  if (sourceFrameworkId === 'cjis' && Object.keys(cjisFedrampData.cjis_to_fedramp).length > 0) {
    return buildDirectCJISMappings(cjisFedrampData.cjis_to_fedramp);
  }

  // Prefer loaded CCF bridge when present for rich coverage
  if (frameworkToBridge[sourceFrameworkId] && bridgeToFramework['fedramp-rev5']) {
    return buildCCFBridgeMappings(
      frameworkToBridge[sourceFrameworkId],
      bridgeToFramework['fedramp-rev5'],
    );
  }

  // Built-in public-domain fallbacks (no local CCF overlay required)
  if (sourceFrameworkId === 'nist-800-53-r5') {
    return buildDirectNist80053Mappings();
  }

  if (sourceFrameworkId === 'nist-csf-v2') {
    return buildCsfToFedrampViaNistMappings();
  }

  return [];
}

function buildDirectNist80053Mappings(): CrosswalkMapping[] {
  const controls = getFrameworkData('fedramp-rev5').controls;
  return controls.map((c) => ({
    fedrampControlId: c.control_id,
    sourceControlIds: [c.control_id],
    bridgeType: 'direct' as const,
  }));
}

function buildCsfToFedrampViaNistMappings(): CrosswalkMapping[] {
  const csfControls = getFrameworkData('nist-csf-v2').controls;
  const fedrampByCanon = getFedrampByCanonicalNistId();
  const mappingMap = new Map<string, CrosswalkMapping>();

  for (const csfControl of csfControls) {
    const nistIds = getNistControlsForCSF(csfControl.control_id);
    for (const nistId of nistIds) {
      const matchedFedramp = fedrampByCanon.get(canonicalNistId(nistId)) ?? [];
      for (const fedrampId of matchedFedramp) {
        const existing = mappingMap.get(fedrampId);
        if (existing) {
          if (!existing.sourceControlIds.includes(csfControl.control_id)) {
            existing.sourceControlIds.push(csfControl.control_id);
          }
        } else {
          mappingMap.set(fedrampId, {
            fedrampControlId: fedrampId,
            sourceControlIds: [csfControl.control_id],
            bridgeType: 'direct',
          });
        }
      }
    }
  }

  return Array.from(mappingMap.values());
}

function buildDirectCJISMappings(cjisToFedramp: Record<string, string[]>): CrosswalkMapping[] {
  const mappings: CrosswalkMapping[] = [];

  for (const [cjisId, fedrampIds] of Object.entries(cjisToFedramp)) {
    for (const fId of fedrampIds) {
      const existing = mappings.find((m) => m.fedrampControlId === fId);
      if (existing) {
        if (!existing.sourceControlIds.includes(cjisId)) {
          existing.sourceControlIds.push(cjisId);
        }
      } else {
        mappings.push({
          fedrampControlId: fId,
          sourceControlIds: [cjisId],
          bridgeType: 'direct',
        });
      }
    }
  }

  return mappings;
}

function buildCCFBridgeMappings(
  fwToCcf: Record<string, string[]>,
  ccfToFedramp: Record<string, string[]>,
): CrosswalkMapping[] {
  const ccfToSourceControls = new Map<string, string[]>();
  for (const [sourceCtrl, ccfIds] of Object.entries(fwToCcf)) {
    for (const ccfId of ccfIds) {
      const existing = ccfToSourceControls.get(ccfId) || [];
      if (!existing.includes(sourceCtrl)) {
        existing.push(sourceCtrl);
      }
      ccfToSourceControls.set(ccfId, existing);
    }
  }

  const mappingMap = new Map<string, CrosswalkMapping>();

  for (const [ccfId, fedrampIds] of Object.entries(ccfToFedramp)) {
    const sourceControls = ccfToSourceControls.get(ccfId);
    if (!sourceControls || sourceControls.length === 0) continue;

    for (const fId of fedrampIds) {
      const existing = mappingMap.get(fId);
      if (existing) {
        for (const sc of sourceControls) {
          if (!existing.sourceControlIds.includes(sc)) {
            existing.sourceControlIds.push(sc);
          }
        }
        if (!existing.bridgeCcfIds?.includes(ccfId)) {
          existing.bridgeCcfIds = [...(existing.bridgeCcfIds || []), ccfId];
        }
      } else {
        mappingMap.set(fId, {
          fedrampControlId: fId,
          sourceControlIds: [...sourceControls],
          bridgeCcfIds: [ccfId],
          bridgeType: 'ccf-bridge',
        });
      }
    }
  }

  return Array.from(mappingMap.values());
}

export function generateCrosswalkSuggestions(
  sourceFrameworkId: string,
  complianceLevel: 'full' | 'partial',
  existingStatuses: Map<string, ImplementationStatus>,
  targetBaseline: FedRampBaseline,
): CrosswalkSuggestion[] {
  const mappings = buildCrosswalkMappings(sourceFrameworkId);
  const baselineControlIds = getBaselineControlIds(targetBaseline);
  const suggestions: CrosswalkSuggestion[] = [];

  const sourceName = CROSSWALK_SOURCE_FRAMEWORKS.find((f) => f.id === sourceFrameworkId)?.name || sourceFrameworkId;

  for (const mapping of mappings) {
    if (!baselineControlIds.has(mapping.fedrampControlId)) continue;

    const key = `fedramp-rev5:${mapping.fedrampControlId}`;
    const existing = existingStatuses.get(key);
    if (existing && existing !== 'not-assessed') continue;

    const suggestedStatus: ImplementationStatus =
      complianceLevel === 'full' ? 'partially-implemented' : 'planned';

    let confidence: 'high' | 'medium' | 'low';
    if (mapping.bridgeType === 'direct') {
      confidence = 'high';
    } else if (mapping.sourceControlIds.length >= 3) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    const reason = buildSuggestionReason(mapping, sourceName, complianceLevel);

    suggestions.push({
      fedrampControlId: mapping.fedrampControlId,
      suggestedStatus,
      confidence,
      sourceFrameworkId,
      sourceControlIds: mapping.sourceControlIds,
      bridgeType: mapping.bridgeType,
      reason,
    });
  }

  const confidenceOrder = { high: 0, medium: 1, low: 2 };
  return suggestions.sort((a, b) => {
    const confDiff = confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    if (confDiff !== 0) return confDiff;
    return a.fedrampControlId.localeCompare(b.fedrampControlId);
  });
}

function buildSuggestionReason(
  mapping: CrosswalkMapping,
  sourceName: string,
  complianceLevel: 'full' | 'partial',
): string {
  const sourceCount = mapping.sourceControlIds.length;
  const sourceList = mapping.sourceControlIds.slice(0, 3).join(', ');
  const more = sourceCount > 3 ? ` +${sourceCount - 3} more` : '';

  if (mapping.bridgeType === 'direct') {
    return `Directly mapped from ${sourceName} (${sourceList}${more}). ${complianceLevel === 'full' ? 'Full' : 'Partial'} compliance suggests this control is partially addressed.`;
  }

  const ccfCount = mapping.bridgeCcfIds?.length || 0;
  return `Mapped via ${ccfCount} CCF control${ccfCount !== 1 ? 's' : ''} from ${sourceName} (${sourceList}${more}). Review FedRAMP-specific parameters before marking as implemented.`;
}

export function generateAutoFillSummary(
  sourceFrameworkId: string,
  complianceLevel: 'full' | 'partial',
  existingStatuses: Map<string, ImplementationStatus>,
  targetBaseline: FedRampBaseline,
): AutoFillSummary {
  const suggestions = generateCrosswalkSuggestions(
    sourceFrameworkId, complianceLevel, existingStatuses, targetBaseline,
  );

  const sourceName = CROSSWALK_SOURCE_FRAMEWORKS.find((f) => f.id === sourceFrameworkId)?.name || sourceFrameworkId;

  return {
    sourceFrameworkId,
    sourceFrameworkName: sourceName,
    complianceLevel,
    totalSuggestions: suggestions.length,
    highConfidence: suggestions.filter((s) => s.confidence === 'high').length,
    mediumConfidence: suggestions.filter((s) => s.confidence === 'medium').length,
    lowConfidence: suggestions.filter((s) => s.confidence === 'low').length,
    suggestions,
  };
}

export function previewAutoFillCount(
  sourceFrameworkId: string,
  targetBaseline: FedRampBaseline,
): number {
  const mappings = buildCrosswalkMappings(sourceFrameworkId);
  const baselineControlIds = getBaselineControlIds(targetBaseline);

  return mappings.filter((m) => baselineControlIds.has(m.fedrampControlId)).length;
}
