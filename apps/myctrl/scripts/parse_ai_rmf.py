#!/usr/bin/env python3
"""
Parse NIST AI RMF Playbook JSON into framework format for myctrl.tools
Source: https://airc.nist.gov/airmf-resources/playbook/
"""

import json
import re
from pathlib import Path

def parse_control_id(title: str) -> str:
    """Convert 'GOVERN 1.1' to 'GOVERN-1.1'"""
    return title.replace(' ', '-')

def parse_family(type_name: str) -> str:
    """Convert type to lowercase family key"""
    return type_name.lower()

def main():
    # Load source data
    source_path = Path(__file__).parent.parent / 'nist_ai_rmf_playbook.json'
    with open(source_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Build framework structure
    framework = {
        "framework": {
            "id": "nist-ai-rmf",
            "name": "NIST AI RMF",
            "version": "1.0",
            "description": "AI Risk Management Framework Playbook - Suggested actions for trustworthy AI"
        },
        "families": {
            "govern": "Govern",
            "map": "Map",
            "measure": "Measure",
            "manage": "Manage"
        },
        "controls": []
    }

    # Process each playbook item
    for item in data:
        control = {
            "control_id": parse_control_id(item["title"]),
            "title": item["description"],
            "family": parse_family(item["type"]),
            "category": item["category"],
            "description": item["description"],  # Required by BaseControl
            "about": item.get("section_about", ""),
            "suggested_actions": item.get("section_actions", ""),
            "documentation": item.get("section_doc", ""),
            "references": item.get("section_ref", ""),
            "ai_actors": item.get("AI Actors", []),
            "topics": item.get("Topic", [])
        }
        framework["controls"].append(control)

    # Sort controls by ID
    def sort_key(c):
        # Extract parts: GOVERN-1.1 -> (GOVERN, 1, 1)
        match = re.match(r'([A-Z]+)-(\d+)\.(\d+)', c["control_id"])
        if match:
            func_order = {"GOVERN": 0, "MAP": 1, "MEASURE": 2, "MANAGE": 3}
            return (func_order.get(match.group(1), 99), int(match.group(2)), int(match.group(3)))
        return (99, 99, 99)

    framework["controls"].sort(key=sort_key)

    # Write output
    output_path = Path(__file__).parent.parent / 'src' / 'data' / 'nist-ai-rmf.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(framework, f, indent=2, ensure_ascii=False)

    print(f"Generated {len(framework['controls'])} controls")
    print(f"Output: {output_path}")

    # Print summary by family
    from collections import Counter
    families = Counter(c["family"] for c in framework["controls"])
    for family, count in sorted(families.items()):
        print(f"  {family}: {count}")

if __name__ == "__main__":
    main()
