import { describe, expect, it } from 'vitest';
import {
  buildAssessmentCryptoSummary,
  buildCertificateAlgorithmMap,
  buildControlCmvpEvidenceSummary,
  detailToNormalizedCmvpModule,
  filterCmvpModules,
  normalizeCmvpCertificateDetail,
  normalizeCmvpRecord,
  type AssessmentCryptoModule,
  type CmvpCertificateDetail,
  type NormalizedCmvpModule,
} from '@/lib/cmvp';

describe('cmvp utilities', () => {
  it('builds a certificate to algorithm map from the upstream algorithm payload', () => {
    const map = buildCertificateAlgorithmMap({
      algorithms: {
        AES: { certificates: [1234, 5678] },
        RSA: { certificates: [1234] },
      },
    });

    expect(map.get('1234')).toEqual(['AES', 'RSA']);
    expect(map.get('5678')).toEqual(['AES']);
  });

  it('normalizes active and in-process module records', () => {
    const algorithms = new Map<string, string[]>([['4321', ['AES', 'RSA']]]);

    const active = normalizeCmvpRecord('active', {
      'Certificate Number': '4321',
      'Vendor Name': 'Example Crypto View Contacts',
      'Module Name': 'Example HSM',
      standard: 'FIPS 140-3',
      status: 'Active',
      module_type: 'Hardware',
      overall_level: 3,
      'Validation Date': '08/30/202109/21/202110/18/2021',
      sunset_date: '8/29/2026',
      security_policy_url: 'https://example.com/policy.pdf',
    }, algorithms);

    const inProcess = normalizeCmvpRecord('in_process', {
      'Vendor Name': 'Preview Vendor',
      'Module Name': 'Preview Module',
      'Status': 'Review Pending',
    }, algorithms);

    expect(active.certificateNumber).toBe('4321');
    expect(active.vendorName).toBe('Example Crypto');
    expect(active.algorithms).toEqual(['AES', 'RSA']);
    expect(active.standard).toBe('FIPS 140-3');
    expect(active.validationDate).toBe('08/30/2021, 09/21/2021, 10/18/2021');
    expect(active.sunsetDate).toBe('8/29/2026');
    expect(inProcess.id).toContain('in-process:preview-vendor-preview-module-review-pending');
    expect(inProcess.algorithms).toEqual([]);
  });

  it('filters and ranks modules by query and structured filters', () => {
    const modules: NormalizedCmvpModule[] = [
      {
        id: '1111',
        dataset: 'active',
        certificateNumber: '1111',
        vendorName: 'Vendor A',
        moduleName: 'Transit Encryptor',
        standard: 'FIPS 140-3',
        status: 'Active',
        moduleType: 'Software',
        overallLevel: 1,
        validationDate: null,
        sunsetDate: null,
        algorithms: ['AES'],
        securityPolicyUrl: null,
        certificateDetailUrl: null,
        caveat: null,
        description: 'Handles in-transit encryption.',
        embodiment: null,
      },
      {
        id: '2222',
        dataset: 'historical',
        certificateNumber: '2222',
        vendorName: 'Vendor B',
        moduleName: 'Legacy Encryptor',
        standard: 'FIPS 140-2',
        status: 'Historical',
        moduleType: 'Hardware',
        overallLevel: 2,
        validationDate: null,
        sunsetDate: '2024-01-01',
        algorithms: ['Triple-DES'],
        securityPolicyUrl: null,
        certificateDetailUrl: null,
        caveat: null,
        description: 'Older legacy hardware.',
        embodiment: null,
      },
    ];

    const filtered = filterCmvpModules(modules, {
      q: 'encryptor',
      scope: 'all',
      limit: 25,
      standard: '',
      moduleType: '',
      status: '',
      algorithm: '',
    });
    const algorithmFiltered = filterCmvpModules(modules, {
      q: '',
      scope: 'all',
      limit: 25,
      standard: '',
      moduleType: '',
      status: '',
      algorithm: 'aes',
    });

    expect(filtered.map((module) => module.certificateNumber)).toEqual(['1111', '2222']);
    expect(algorithmFiltered.map((module) => module.certificateNumber)).toEqual(['1111']);
  });

  it('normalizes certificate detail payloads and converts them back to summary records', () => {
    const detail = normalizeCmvpCertificateDetail({
      metadata: {
        generated_at: '2026-03-26T00:00:00.000000Z',
        dataset: 'active',
        source: 'https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5203',
      },
      certificate: {
        certificate_number: '5203',
        dataset: 'active',
        generated_at: '2026-03-26T00:00:00.000000Z',
        nist_page_url: 'https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5203',
        certificate_detail_url: 'https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5203',
        security_policy_url: 'https://csrc.nist.gov/security-policy.pdf',
        vendor_name: 'OVH SAS',
        module_name: 'OVHCloud OKMS Provider based on the OpenSSL FIPS Provider',
        standard: 'FIPS 140-3',
        status: 'Active',
        module_type: 'Software',
        embodiment: 'MultiChipStand',
        overall_level: 1,
        validation_dates: ['3/21/2026', '4/01/2026'],
        sunset_date: '3/10/2030',
        caveat: 'When operated in approved mode.',
        description: 'A software library providing cryptographic functionality.',
        security_level_exceptions: ['Physical security: N/A', 'Life-cycle assurance: Level 3'],
        related_files: [{ label: 'Security Policy', url: 'https://csrc.nist.gov/security-policy.pdf' }],
        validation_history: [{ date: '3/21/2026', type: 'Initial', lab: 'Lightship Security, Inc.' }],
        vendor: {
          name: 'OVH SAS',
          website_url: 'https://corporate.ovhcloud.com/en/',
          address_lines: ['2 RUE KELLERMANN', 'ROUBAIX 59100', 'FRANCE'],
          country: 'FRANCE',
          contact_name: 'Data security team',
          contact_email: 'okms_fips@ovh.net',
          contact_phone: '+33 3 20 82 73 32',
        },
        algorithms: ['AES', 'HMAC'],
      },
    });

    expect(detail).not.toBeNull();
    expect(detail?.vendor.contactEmail).toBe('okms_fips@ovh.net');
    expect(detail?.validationDates).toEqual(['3/21/2026', '4/01/2026']);
    expect(detail?.securityLevelExceptions).toContain('Physical security: N/A');

    const summary = detailToNormalizedCmvpModule(detail as CmvpCertificateDetail);
    expect(summary.id).toBe('5203');
    expect(summary.algorithms).toEqual(['AES', 'HMAC']);
    expect(summary.certificateDetailUrl).toContain('/certificate/5203');
  });

  it('builds assessment and control summaries for linked modules', () => {
    const modules: AssessmentCryptoModule[] = [
      {
        id: 'assessment-1:1111',
        moduleId: '1111',
        assessmentId: 'assessment-1',
        dataset: 'active',
        certificateNumber: '1111',
        vendorName: 'Vendor A',
        moduleName: 'Transit Encryptor',
        standard: 'FIPS 140-3',
        status: 'Active',
        moduleType: 'Software',
        overallLevel: 1,
        validationDate: null,
        sunsetDate: null,
        algorithms: ['AES', 'RSA'],
        securityPolicyUrl: null,
        certificateDetailUrl: null,
        caveat: null,
        description: null,
        embodiment: null,
        componentName: 'API Gateway',
        usageTypes: ['in-transit', 'signing'],
        notes: 'Used for public TLS termination.',
        detailSnapshot: {
          certificateNumber: '1111',
          dataset: 'active',
          generatedAt: '2026-03-26T00:00:00.000000Z',
          nistPageUrl: 'https://example.com/1111',
          certificateDetailUrl: 'https://example.com/1111',
          securityPolicyUrl: 'https://example.com/1111.pdf',
          vendorName: 'Vendor A',
          moduleName: 'Transit Encryptor',
          standard: 'FIPS 140-3',
          status: 'Active',
          moduleType: 'Software',
          embodiment: null,
          overallLevel: 1,
          validationDate: '03/21/2026',
          validationDates: ['03/21/2026'],
          sunsetDate: null,
          caveat: null,
          description: null,
          securityLevelExceptions: ['Physical security: N/A'],
          relatedFiles: [],
          validationHistory: [{ date: '03/21/2026', type: 'Initial', lab: 'Example Lab' }],
          vendor: {
            name: 'Vendor A',
            websiteUrl: null,
            addressLines: [],
            country: null,
            contactName: null,
            contactEmail: null,
            contactPhone: null,
          },
          algorithms: ['AES', 'RSA'],
        },
        snapshottedAt: 2,
        sourceGeneratedAt: '2026-03-26T00:00:00.000000Z',
        stale: true,
        addedAt: 1,
        updatedAt: 1,
      },
      {
        id: 'assessment-1:2222',
        moduleId: '2222',
        assessmentId: 'assessment-1',
        dataset: 'historical',
        certificateNumber: '2222',
        vendorName: 'Vendor B',
        moduleName: 'Storage HSM',
        standard: 'FIPS 140-2',
        status: 'Historical',
        moduleType: 'Hardware',
        overallLevel: 2,
        validationDate: null,
        sunsetDate: '2024-01-01',
        algorithms: ['AES'],
        securityPolicyUrl: null,
        certificateDetailUrl: null,
        caveat: null,
        description: null,
        embodiment: null,
        componentName: 'Key Vault',
        usageTypes: ['key-management', 'at-rest'],
        notes: 'Legacy tenant key storage.',
        addedAt: 1,
        updatedAt: 1,
      },
    ];

    const assessmentSummary = buildAssessmentCryptoSummary(modules);
    const controlSummary = buildControlCmvpEvidenceSummary([modules[0]]);

    expect(assessmentSummary).toContain('2 CMVP modules recorded.');
    expect(assessmentSummary).toContain('Statuses: Active: 1, Historical: 1.');
    expect(assessmentSummary).toContain('Algorithms: AES, RSA.');
    expect(assessmentSummary).toContain('Snapshots needing refresh: 1.');
    expect(controlSummary).toContain('Certificate 1111');
    expect(controlSummary).toContain('Component: API Gateway');
    expect(controlSummary).toContain('Usage: in-transit, signing');
    expect(controlSummary).toContain('Validation history: 03/21/2026 (Initial via Example Lab)');
    expect(controlSummary).toContain('Security level exceptions: Physical security: N/A');
  });
});
