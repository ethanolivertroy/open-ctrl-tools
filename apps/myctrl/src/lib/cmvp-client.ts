import type {
  CmvpCertificateDetail,
  CmvpFilterMetadata,
  CmvpMetadataSummary,
  CmvpSearchFilters,
  CmvpSearchResult,
  NormalizedCmvpModule,
} from './cmvp';
import {
  getCmvpCertificateDetail,
  getCmvpFilterMetadata,
  getCmvpMetadata,
  getCmvpModuleByCertificate,
  searchCmvpModules,
} from './cmvp';

export interface CmvpMetadataResponse {
  metadata: CmvpMetadataSummary;
  filters: CmvpFilterMetadata;
}

export async function fetchCmvpMetadata(): Promise<CmvpMetadataResponse> {
  const [metadata, filterMetadata] = await Promise.all([
    getCmvpMetadata(),
    getCmvpFilterMetadata(),
  ]);

  return {
    metadata,
    filters: filterMetadata,
  };
}

export async function fetchCmvpSearch(filters: Partial<CmvpSearchFilters>): Promise<CmvpSearchResult> {
  return searchCmvpModules(filters);
}

export async function fetchCmvpCertificate(certificate: string): Promise<NormalizedCmvpModule> {
  const module = await getCmvpModuleByCertificate(certificate);
  if (!module) {
    throw new Error(`No CMVP certificate found for ${certificate}.`);
  }

  return module;
}

export async function fetchCmvpCertificateDetail(certificate: string): Promise<CmvpCertificateDetail> {
  const detail = await getCmvpCertificateDetail(certificate);
  if (!detail) {
    throw new Error(`No CMVP detail record found for ${certificate}.`);
  }

  return detail;
}
