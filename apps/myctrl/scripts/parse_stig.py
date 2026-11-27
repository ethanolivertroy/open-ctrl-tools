#!/usr/bin/env python3
"""
Parse DISA STIG XCCDF XML files into JSON format for myctrl.tools.

Usage:
    python scripts/parse_stig.py <xccdf_xml_file> <output_json_file> <framework_id> <framework_name> <version>

Example:
    python scripts/parse_stig.py \
        U_Kubernetes_V2R4_STIG/U_Kubernetes_V2R4_Manual_STIG/U_Kubernetes_STIG_V2R4_Manual-xccdf.xml \
        src/data/kubernetes-stig-v2r4.json \
        kubernetes-stig-v2r4 \
        "Kubernetes STIG" \
        "V2R4"
"""

import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from html import unescape

# XCCDF namespace
NS = {
    'xccdf': 'http://checklists.nist.gov/xccdf/1.1',
    'dc': 'http://purl.org/dc/elements/1.1/',
}


def clean_text(text: str) -> str:
    """Clean and normalize text content."""
    if not text:
        return ""
    # Unescape HTML entities
    text = unescape(text)
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def parse_description(desc_text: str) -> dict:
    """Parse the description field which contains embedded XML-like structure."""
    result = {
        'vuln_discussion': '',
        'false_positives': '',
        'false_negatives': '',
        'documentable': '',
        'mitigations': '',
        'severity_override_guidance': '',
        'potential_impacts': '',
        'third_party_tools': '',
        'mitigation_control': '',
        'responsibility': '',
        'security_override_guidance': '',
    }

    if not desc_text:
        return result

    # Parse embedded XML structure
    patterns = [
        ('vuln_discussion', r'<VulnDiscussion>(.*?)</VulnDiscussion>'),
        ('false_positives', r'<FalsePositives>(.*?)</FalsePositives>'),
        ('false_negatives', r'<FalseNegatives>(.*?)</FalseNegatives>'),
        ('documentable', r'<Documentable>(.*?)</Documentable>'),
        ('mitigations', r'<Mitigations>(.*?)</Mitigations>'),
        ('severity_override_guidance', r'<SeverityOverrideGuidance>(.*?)</SeverityOverrideGuidance>'),
        ('potential_impacts', r'<PotentialImpacts>(.*?)</PotentialImpacts>'),
        ('third_party_tools', r'<ThirdPartyTools>(.*?)</ThirdPartyTools>'),
        ('mitigation_control', r'<MitigationControl>(.*?)</MitigationControl>'),
        ('responsibility', r'<Responsibility>(.*?)</Responsibility>'),
    ]

    for key, pattern in patterns:
        match = re.search(pattern, desc_text, re.DOTALL)
        if match:
            result[key] = clean_text(match.group(1))

    return result


def derive_family(title: str, check_content: str) -> tuple[str, str]:
    """Derive the Kubernetes component family from the finding title/content."""
    title_lower = title.lower()
    check_lower = check_content.lower() if check_content else ""
    combined = title_lower + " " + check_lower

    # Map keywords to families
    family_map = [
        ('controller-manager', 'Controller Manager', ['controller manager', 'controller-manager', 'kube-controller']),
        ('api-server', 'API Server', ['api server', 'api-server', 'kube-apiserver', 'apiserver']),
        ('scheduler', 'Scheduler', ['scheduler', 'kube-scheduler']),
        ('etcd', 'etcd', ['etcd']),
        ('kubelet', 'Kubelet', ['kubelet']),
        ('proxy', 'Proxy', ['kube-proxy', 'proxy']),
        ('network', 'Network', ['network polic', 'cni', 'ingress', 'service mesh']),
        ('rbac', 'RBAC', ['rbac', 'role-based', 'clusterrole', 'rolebinding']),
        ('secrets', 'Secrets', ['secret', 'encryption at rest', 'etcd encryption']),
        ('audit', 'Audit', ['audit log', 'audit polic', 'auditing']),
        ('pod-security', 'Pod Security', ['pod security', 'securitycontext', 'privileged', 'hostpath', 'hostnetwork']),
    ]

    for family_id, family_name, keywords in family_map:
        for keyword in keywords:
            if keyword in combined:
                return family_id, family_name

    return 'general', 'General'


def parse_stig_xml(xml_path: str) -> dict:
    """Parse STIG XCCDF XML and return structured data."""
    tree = ET.parse(xml_path)
    root = tree.getroot()

    controls = []
    families = defaultdict(str)

    # Find all Group elements (each contains one Rule)
    for group in root.findall('.//xccdf:Group', NS):
        group_id = group.get('id')  # V-XXXXXX

        rule = group.find('xccdf:Rule', NS)
        if rule is None:
            continue

        rule_id = rule.get('id')  # SV-XXXXXX_rule
        severity = rule.get('severity', 'medium')  # high, medium, low

        # Get title
        title_elem = rule.find('xccdf:title', NS)
        title = clean_text(title_elem.text) if title_elem is not None else ""

        # Get description (contains VulnDiscussion, etc.)
        desc_elem = rule.find('xccdf:description', NS)
        desc_text = desc_elem.text if desc_elem is not None else ""
        desc_parsed = parse_description(desc_text)

        # Get check content
        check_elem = rule.find('.//xccdf:check-content', NS)
        check_content = clean_text(check_elem.text) if check_elem is not None else ""

        # Get fix text
        fix_elem = rule.find('xccdf:fixtext', NS)
        fix_text = clean_text(fix_elem.text) if fix_elem is not None else ""

        # Get CCI references
        cci_refs = []
        for ident in rule.findall('xccdf:ident', NS):
            system = ident.get('system', '')
            if 'cci' in system.lower():
                cci_refs.append(ident.text)

        # Derive family from content
        family_id, family_name = derive_family(title, check_content)
        families[family_id] = family_name

        # Get version code (CNTR-K8-XXXXXX)
        version_elem = rule.find('xccdf:version', NS)
        version_code = version_elem.text if version_elem is not None else ""

        control = {
            'control_id': group_id,
            'title': title,
            'family': family_id,
            'description': desc_parsed['vuln_discussion'],
            'stig_id': group_id,
            'rule_id': rule_id,
            'version_code': version_code,
            'severity': severity,
            'cci_refs': cci_refs,
            'check_content': check_content,
            'fix_text': fix_text,
        }

        # Add optional fields if present
        if desc_parsed.get('mitigations'):
            control['mitigations'] = desc_parsed['mitigations']
        if desc_parsed.get('potential_impacts'):
            control['potential_impacts'] = desc_parsed['potential_impacts']

        controls.append(control)

    # Sort controls by V-ID numerically
    controls.sort(key=lambda c: int(re.search(r'V-(\d+)', c['control_id']).group(1)))

    return {
        'controls': controls,
        'families': dict(families),
    }


def main():
    if len(sys.argv) != 6:
        print(__doc__)
        sys.exit(1)

    xml_path = sys.argv[1]
    output_path = sys.argv[2]
    framework_id = sys.argv[3]
    framework_name = sys.argv[4]
    version = sys.argv[5]

    print(f"Parsing {xml_path}...")
    data = parse_stig_xml(xml_path)

    # Build output structure
    output = {
        'framework': {
            'id': framework_id,
            'name': framework_name,
            'version': version,
            'description': f'DoD Security Technical Implementation Guide for {framework_name.replace(" STIG", "")}',
        },
        'families': data['families'],
        'controls': data['controls'],
    }

    # Write output
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    # Print summary
    severity_counts = defaultdict(int)
    family_counts = defaultdict(int)
    for control in data['controls']:
        severity_counts[control['severity']] += 1
        family_counts[control['family']] += 1

    print(f"\nParsed {len(data['controls'])} findings")
    print(f"\nBy severity:")
    for sev, count in sorted(severity_counts.items()):
        cat = {'high': 'CAT I', 'medium': 'CAT II', 'low': 'CAT III'}.get(sev, sev)
        print(f"  {cat} ({sev}): {count}")

    print(f"\nBy component:")
    for family, count in sorted(family_counts.items(), key=lambda x: -x[1]):
        print(f"  {data['families'].get(family, family)}: {count}")

    print(f"\nOutput written to {output_path}")


if __name__ == '__main__':
    main()
