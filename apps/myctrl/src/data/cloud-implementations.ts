// Cloud implementation examples for NIST 800-53 controls
// Shows AWS CLI, Azure CLI, GCP CLI, IBM Cloud CLI, and OCI CLI commands to check/implement controls
//
// NOTE: src/data/cloud-implementations.json is the source of truth for the
// implementation content. This module is a thin typed accessor over that JSON.

import cloudImplementationsJson from './cloud-implementations.json';

export interface CliCommand {
  description: string;
  command: string;
}

export interface CloudProvider {
  services: string[];
  cli: CliCommand[];
  console?: string;
  docs?: string;
}

export interface CloudImplementation {
  controlId: string;
  title: string;
  aws?: CloudProvider;
  azure?: CloudProvider;
  gcp?: CloudProvider;
  ibm?: CloudProvider;
  oci?: CloudProvider;
}

export const cloudImplementations: CloudImplementation[] =
  (cloudImplementationsJson as unknown as { implementations: CloudImplementation[] }).implementations;

// O(1) lookup by upper-cased control ID, built once at module init.
// Uses first-match semantics to mirror the previous Array.find behavior.
const implementationsByControlId = new Map<string, CloudImplementation>();
for (const impl of cloudImplementations) {
  const key = impl.controlId.toUpperCase();
  if (!implementationsByControlId.has(key)) {
    implementationsByControlId.set(key, impl);
  }
}

// Helper function to get implementation by control ID
export function getCloudImplementation(controlId: string): CloudImplementation | undefined {
  return implementationsByControlId.get(controlId.toUpperCase());
}

// Get all control IDs that have implementations
export function getImplementedControlIds(): string[] {
  return cloudImplementations.map(impl => impl.controlId);
}
