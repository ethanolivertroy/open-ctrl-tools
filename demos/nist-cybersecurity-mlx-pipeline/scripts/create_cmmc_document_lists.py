#!/usr/bin/env python3
"""
Create CMMC-focused document lists from NIST metadata.

This script identifies CMMC-relevant documents and creates three variants:
- Core: 13 foundational CMMC documents
- Balanced: 50-75 documents covering all domains
- Comprehensive: 178 documents with complete technical coverage
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Set

# CMMC Core Documents (Foundation) - use exact URL patterns
CORE_DOCUMENT_URLS = [
    # Primary CMMC requirements (Priority 1)
    "sp/800/171/r3",       # SP 800-171 R3 - CMMC Level 2
    "sp/800/172/r3",       # SP 800-172 R3 - CMMC Level 3 enhanced
    "sp/800/172/final",    # SP 800-172 (if R3 doesn't exist)
    "sp/800/53/r5",        # SP 800-53 R5 - Master control catalog

    # Assessment procedures (Priority 2)
    "sp/800/171/a",        # SP 800-171A - Assessment procedures
    "sp/800/172/a",        # SP 800-172A - Enhanced assessment
    "sp/800/53/a",         # SP 800-53A - Assessment methods
    "sp/800/53/b",         # SP 800-53B - Control baselines

    # Key implementation guides (Priority 3)
    "sp/800/37",           # Risk Management Framework
    "sp/800/61",           # Incident Response
    "sp/800/161",          # Supply Chain Risk Management
    "sp/800/207",          # Zero Trust Architecture
]

# Core document title patterns (fallback)
CORE_TITLE_PATTERNS = [
    "protecting controlled unclassified information",  # SP 800-171
    "enhanced security requirements",                   # SP 800-172
    "security and privacy controls",                   # SP 800-53
    "assessing security requirements for controlled",  # SP 800-171A
    "assessing enhanced security requirements",        # SP 800-172A
]

# CMMC Domain Keywords (17 domains)
DOMAIN_KEYWORDS = {
    "Access Control": ["access control", "ac-", "authorization", "least privilege", "rbac", "abac"],
    "Awareness and Training": ["awareness", "training", "education", "at-"],
    "Audit and Accountability": ["audit", "logging", "accountability", "au-"],
    "Configuration Management": ["configuration", "baseline", "cm-", "change control"],
    "Identification and Authentication": ["authentication", "identity", "ia-", "mfa", "multifactor", "piv", "credential"],
    "Incident Response": ["incident response", "ir-", "forensics", "malware"],
    "Maintenance": ["maintenance", "ma-", "patching", "updates"],
    "Media Protection": ["media protection", "mp-", "sanitization", "disposal"],
    "Personnel Security": ["personnel", "ps-", "background check", "insider threat"],
    "Physical Protection": ["physical", "pe-", "facility", "visitor"],
    "Risk Assessment": ["risk assessment", "ra-", "vulnerability", "threat"],
    "Security Assessment": ["security assessment", "ca-", "testing", "evaluation", "scap"],
    "System and Communications Protection": ["communications", "sc-", "encryption", "cryptography", "tls", "ipsec", "boundary"],
    "System and Information Integrity": ["integrity", "si-", "flaw remediation", "malicious code"],
    "Planning": ["security plan", "pl-", "planning", "rules of behavior"],
    "System and Services Acquisition": ["acquisition", "sa-", "sdlc", "development"],
    "Supply Chain Risk Management": ["supply chain", "sr-", "c-scrm", "supplier"],
}

# Additional relevant topics for Balanced dataset
BALANCED_TOPICS = [
    "cloud", "zero trust", "iot", "privacy", "contingency", "disaster recovery",
    "mobile", "wireless", "email security", "dns security", "identity management",
    "vulnerability management", "patch management", "network security",
    "application security", "data protection", "backup", "recovery"
]

def load_metadata(metadata_path: Path) -> List[Dict]:
    """Load NIST metadata.json file."""
    with open(metadata_path) as f:
        return json.load(f)

def matches_pattern(text: str, patterns: List[str]) -> bool:
    """Check if text matches any of the patterns (case-insensitive)."""
    text_lower = text.lower()
    return any(pattern.lower() in text_lower for pattern in patterns)

def is_core_document(doc: Dict) -> bool:
    """Check if document is a core CMMC document."""
    title = doc.get("title", "").lower()
    detail_url = doc.get("detail_url", "").lower()

    # Priority 1: Check URL patterns (most reliable)
    for url_pattern in CORE_DOCUMENT_URLS:
        if url_pattern in detail_url:
            return True

    # Priority 2: Check title patterns
    for title_pattern in CORE_TITLE_PATTERNS:
        if title_pattern in title:
            return True

    return False

def get_domain_relevance(doc: Dict) -> Set[str]:
    """Determine which CMMC domains this document is relevant to."""
    title = doc.get("title", "")
    detail_url = doc.get("detail_url", "")
    combined_text = f"{title} {detail_url}".lower()

    relevant_domains = set()
    for domain, keywords in DOMAIN_KEYWORDS.items():
        if matches_pattern(combined_text, keywords):
            relevant_domains.add(domain)

    return relevant_domains

def is_balanced_document(doc: Dict, domains: Set[str]) -> bool:
    """Check if document should be in Balanced dataset."""
    title = doc.get("title", "")

    # Include if it's domain-relevant
    if domains:
        return True

    # Include if it matches balanced topics
    if matches_pattern(title, BALANCED_TOPICS):
        return True

    return False

def is_comprehensive_document(doc: Dict) -> bool:
    """Check if document should be in Comprehensive dataset."""
    title = doc.get("title", "")
    detail_url = doc.get("detail_url", "")

    # Include all SP 800 series
    if "sp/800" in detail_url.lower() or "sp 800-" in title.lower():
        return True

    # Include FIPS (cryptography standards)
    if "fips" in detail_url.lower() or "fips" in title.lower():
        return True

    # Include IR documents related to security
    if "ir/" in detail_url.lower():
        security_keywords = ["security", "cyber", "privacy", "risk", "incident", "forensic", "malware", "threat"]
        if matches_pattern(title, security_keywords):
            return True

    # Include CSWP (white papers)
    if "cswp" in detail_url.lower():
        return True

    return False

def extract_control_family(doc: Dict) -> str:
    """Extract control family from document (e.g., AC, IR, SC)."""
    title = doc.get("title", "")

    # Look for patterns like "Access Control", "Incident Response", etc.
    for domain, keywords in DOMAIN_KEYWORDS.items():
        if keywords[0] in title.lower():  # First keyword is usually the main term
            # Map to control family abbreviation
            abbrev_map = {
                "Access Control": "AC",
                "Awareness and Training": "AT",
                "Audit and Accountability": "AU",
                "Configuration Management": "CM",
                "Identification and Authentication": "IA",
                "Incident Response": "IR",
                "Maintenance": "MA",
                "Media Protection": "MP",
                "Personnel Security": "PS",
                "Physical Protection": "PE",
                "Risk Assessment": "RA",
                "Security Assessment": "CA",
                "System and Communications Protection": "SC",
                "System and Information Integrity": "SI",
                "Planning": "PL",
                "System and Services Acquisition": "SA",
                "Supply Chain Risk Management": "SR",
            }
            return abbrev_map.get(domain, "")

    return ""

def detect_cmmc_level(doc: Dict) -> str:
    """Detect which CMMC level this document relates to."""
    title = doc.get("title", "")
    detail_url = doc.get("detail_url", "")

    # SP 800-172 is Level 3
    if "800-172" in detail_url or "800-172" in title:
        return "3"

    # SP 800-171 is Level 2
    if "800-171" in detail_url or "800-171" in title:
        return "2"

    # Most other documents apply to all levels
    return "all"

def create_cmmc_metadata(documents: List[Dict]) -> Dict:
    """Create CMMC metadata mapping file."""
    metadata = {
        "cmmc_levels": {
            "1": {"name": "Foundational", "description": "Basic cyber hygiene (17 practices)"},
            "2": {"name": "Advanced", "description": "Full NIST SP 800-171 (110 practices)"},
            "3": {"name": "Expert", "description": "SP 800-171 + SP 800-172 enhanced (134 practices)"}
        },
        "cmmc_domains": list(DOMAIN_KEYWORDS.keys()),
        "documents": []
    }

    for doc in documents:
        doc_meta = {
            "title": doc.get("title", ""),
            "detail_url": doc.get("detail_url", ""),
            "local_path": doc.get("local_path", ""),
            "cmmc_level": detect_cmmc_level(doc),
            "control_family": extract_control_family(doc),
            "domains": list(get_domain_relevance(doc))
        }
        metadata["documents"].append(doc_meta)

    return metadata

def main():
    # Paths
    project_root = Path(__file__).parent.parent
    metadata_path = project_root / "data" / "raw" / "metadata.json"
    output_dir = project_root / "data" / "cmmc"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load metadata
    print("Loading NIST metadata...")
    all_documents = load_metadata(metadata_path)
    print(f"Total documents: {len(all_documents)}")

    # Filter documents
    print("\nFiltering documents...")

    # Core documents
    core_docs = []
    for doc in all_documents:
        if is_core_document(doc):
            core_docs.append(doc)

    print(f"Core documents: {len(core_docs)}")

    # Balanced documents (Core + domain-specific)
    balanced_docs = core_docs.copy()
    for doc in all_documents:
        if doc in balanced_docs:
            continue
        domains = get_domain_relevance(doc)
        if is_balanced_document(doc, domains):
            balanced_docs.append(doc)

    # Limit to ~75 documents, prioritizing diverse domain coverage
    # Group by domain and select top docs per domain
    domain_groups = {}
    for doc in balanced_docs[len(core_docs):]:
        domains = get_domain_relevance(doc)
        for domain in domains:
            if domain not in domain_groups:
                domain_groups[domain] = []
            domain_groups[domain].append(doc)

    # Select top 3-4 docs per domain
    balanced_selected = core_docs.copy()
    for domain, docs in domain_groups.items():
        balanced_selected.extend(docs[:4])

    # Remove duplicates
    seen = set()
    balanced_docs = []
    for doc in balanced_selected:
        doc_id = doc.get("detail_url", "")
        if doc_id not in seen:
            seen.add(doc_id)
            balanced_docs.append(doc)

    print(f"Balanced documents: {len(balanced_docs)}")

    # Comprehensive documents
    comprehensive_docs = []
    for doc in all_documents:
        if is_comprehensive_document(doc):
            comprehensive_docs.append(doc)

    print(f"Comprehensive documents: {len(comprehensive_docs)}")

    # Save document lists
    print("\nSaving document lists...")

    with open(output_dir / "core_documents.json", "w") as f:
        json.dump(core_docs, f, indent=2)
    print(f"✅ Saved: core_documents.json ({len(core_docs)} documents)")

    with open(output_dir / "balanced_documents.json", "w") as f:
        json.dump(balanced_docs, f, indent=2)
    print(f"✅ Saved: balanced_documents.json ({len(balanced_docs)} documents)")

    with open(output_dir / "comprehensive_documents.json", "w") as f:
        json.dump(comprehensive_docs, f, indent=2)
    print(f"✅ Saved: comprehensive_documents.json ({len(comprehensive_docs)} documents)")

    # Create CMMC metadata
    print("\nCreating CMMC metadata...")
    cmmc_meta = create_cmmc_metadata(comprehensive_docs)
    with open(output_dir / "cmmc_metadata.json", "w") as f:
        json.dump(cmmc_meta, f, indent=2)
    print(f"✅ Saved: cmmc_metadata.json")

    # Print summary
    print("\n" + "="*60)
    print("CMMC Document Lists Created Successfully!")
    print("="*60)
    print(f"\n📊 Summary:")
    print(f"  Core:          {len(core_docs):3d} documents (Foundation)")
    print(f"  Balanced:      {len(balanced_docs):3d} documents (Recommended)")
    print(f"  Comprehensive: {len(comprehensive_docs):3d} documents (Complete)")
    print(f"\n📁 Output directory: {output_dir}")

    # Print core document list
    print(f"\n📋 Core Documents ({len(core_docs)}):")
    for i, doc in enumerate(core_docs, 1):
        title = doc.get("title", "")
        print(f"  {i:2d}. {title[:70]}")

if __name__ == "__main__":
    main()
