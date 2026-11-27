#!/usr/bin/env python3
"""
Parse AWS FedRAMP RSC OSCAL files and output src/data/aws-rsc-data.ts.

Reads 18 OSCAL JSON files (9 component-definitions + 9 SSPs) from RSCs/AWS/
and produces a typed TypeScript data file with pre-parsed content blocks.

Usage:
  python3 scripts/transform_aws_rsc.py
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Any

# Service ID mapping: filename prefix → (section id, display name)
SERVICE_MAP = {
    "amazon-elastic-cloud-compute-ec2": ("ec2", "Amazon EC2"),
    "amazon-rds": ("rds", "Amazon RDS"),
    "amazon-aurora-mysql": ("aurora-mysql", "Aurora MySQL"),
    "amazon-aurora-postgresql": ("aurora-postgresql", "Aurora PostgreSQL"),
    "amazon-documentdb-with-mongodb-compatibility": ("documentdb", "DocumentDB"),
    "amazon-neptune": ("neptune", "Neptune"),
    "root-security-guidance": ("root-security", "Root Security"),
    "privileged-account-guidance": ("privileged-accounts", "Privileged Accounts"),
    "top-level-admin-guidance": ("top-level-admin", "Top-Level Admin"),
}

RSC_DIR = Path(__file__).parent.parent / "RSCs" / "AWS"
OUTPUT = Path(__file__).parent.parent / "src" / "data" / "aws-rsc-data.ts"


# ---------------------------------------------------------------------------
# AsciiDoc-lite → content blocks
# ---------------------------------------------------------------------------

def parse_asciidoc(text: str) -> list[dict]:
    """Convert AsciiDoc-lite content into a list of content block dicts."""
    blocks: list[dict] = []
    lines = text.split("\n")
    i = 0

    while i < len(lines):
        line = lines[i]

        # ── Block attribute ([.lead], [.something]) — skip the attribute line ──
        if re.match(r'^\[\.(\w+)\]\s*$', line.strip()):
            i += 1
            continue

        # ── Checklist lines (☐ item +) ──
        if line.strip().startswith('☐'):
            items = []
            while i < len(lines) and lines[i].strip().startswith('☐'):
                item = lines[i].strip().rstrip('+').strip()
                items.append(asciidoc_inline(item))
                i += 1
            if items:
                blocks.append({"type": "list", "items": items, "ordered": False})
            continue

        # ── Heading (===== prefix) ──
        m = re.match(r'^(={2,5})\s+(.+)$', line)
        if m:
            depth = len(m.group(1))  # 2→h2, 3→h3, 4→h4, 5→h4 (cap)
            level = min(depth, 4)
            blocks.append({"type": "heading", "level": level, "text": m.group(2).strip()})
            i += 1
            continue

        # ── Code block ([source,...] + ----) ──
        if line.strip().startswith("[source,"):
            lang_match = re.match(r'\[source,\s*(\w+)', line.strip())
            lang = lang_match.group(1) if lang_match else "text"
            i += 1
            # Skip the opening ----
            if i < len(lines) and lines[i].strip().startswith("----"):
                i += 1
            code_lines = []
            while i < len(lines) and not lines[i].strip().startswith("----"):
                code_lines.append(lines[i])
                i += 1
            if i < len(lines):
                i += 1  # skip closing ----
            code = "\n".join(code_lines).strip()
            # Strip template vars like {tcx5-2025-waiver}
            code = re.sub(r'\{[a-z0-9_-]+\}', '', code)
            if code:
                blocks.append({"type": "code", "language": lang, "code": code})
            continue

        # ── Table (|===) ──
        if line.strip() == "|===":
            i += 1
            rows: list[list[str]] = []
            current_row: list[str] = []
            while i < len(lines) and lines[i].strip() != "|===":
                tline = lines[i].strip()
                if tline.startswith("|"):
                    # Parse cells from this line
                    cells = [c.strip() for c in tline.split("|")[1:] if c.strip()]
                    if cells:
                        if current_row:
                            rows.append(current_row)
                        current_row = cells
                elif tline and current_row:
                    # Continuation of previous cell
                    current_row[-1] += " " + tline
                i += 1
            if current_row:
                rows.append(current_row)
            if i < len(lines):
                i += 1  # skip closing |===

            if rows:
                # First row as headers if 2+ rows
                if len(rows) >= 2:
                    blocks.append({"type": "table", "headers": rows[0], "rows": rows[1:]})
                else:
                    blocks.append({"type": "table", "rows": rows})
            continue

        # ── Ordered list (. Item or . *Bold Item*) ──
        if re.match(r'^\.\s+', line):
            items = []
            while i < len(lines) and re.match(r'^\.\s+', lines[i]):
                item_text = re.sub(r'^\.\s+', '', lines[i]).strip()
                item_text = asciidoc_inline(item_text)
                # Collect continuation lines (+ on next line, then text)
                i += 1
                while i < len(lines) and lines[i].strip() == "+":
                    i += 1  # skip the +
                    # Gather continuation text until next list item, blank, or block
                    cont_parts = []
                    while i < len(lines) and lines[i].strip() and not re.match(r'^\.\s+', lines[i]) and lines[i].strip() != "+" and not lines[i].strip().startswith("[source,"):
                        cont_parts.append(lines[i].strip())
                        i += 1
                    if cont_parts:
                        item_text += "<br/>" + asciidoc_inline(" ".join(cont_parts))
                items.append(item_text)
            if items:
                blocks.append({"type": "list", "items": items, "ordered": True})
            continue

        # ── Unordered list (* Item) ──
        if re.match(r'^\*\s+', line) and not re.match(r'^\*[A-Za-z]', line):
            items = []
            while i < len(lines) and re.match(r'^\*\s+', lines[i]) and not re.match(r'^\*[A-Za-z]', lines[i]):
                item_text = re.sub(r'^\*\s+', '', lines[i]).strip()
                item_text = asciidoc_inline(item_text)
                items.append(item_text)
                i += 1
            if items:
                blocks.append({"type": "list", "items": items, "ordered": False})
            continue

        # ── Dash-style unordered list (- Item) ──
        if re.match(r'^-\s+', line):
            items = []
            while i < len(lines) and re.match(r'^-\s+', lines[i]):
                item_text = re.sub(r'^-\s+', '', lines[i]).strip()
                item_text = asciidoc_inline(item_text)
                items.append(item_text)
                i += 1
            if items:
                blocks.append({"type": "list", "items": items, "ordered": False})
            continue

        # ── Paragraph text ──
        if line.strip():
            para_lines = []
            while (i < len(lines) and lines[i].strip()
                   and not re.match(r'^(={2,5})\s', lines[i])
                   and not lines[i].strip().startswith("[source,")
                   and not lines[i].strip().startswith("[.")
                   and lines[i].strip() != "|==="
                   and not (re.match(r'^\*\s+', lines[i]) and not re.match(r'^\*[A-Za-z]', lines[i]))
                   and not re.match(r'^\.\s+', lines[i])
                   and not re.match(r'^-\s+', lines[i])
                   and not lines[i].strip().startswith('☐')):
                para_lines.append(lines[i].strip())
                i += 1
            text = asciidoc_inline(" ".join(para_lines))
            if text:
                blocks.append({"type": "text", "html": text})
            continue

        i += 1

    return blocks


# Known template variable expansions
TEMPLATE_VARS = {
    'aws': 'AWS',
}


def _expand_template_var(m: re.Match) -> str:
    """Expand known template vars, strip unknown ones."""
    return TEMPLATE_VARS.get(m.group(1), '')


def _link_repl(m: re.Match) -> str:
    """Convert AsciiDoc link to HTML, stripping attributes after first comma."""
    href = m.group(1)
    bracket_content = m.group(2)
    label = bracket_content.split(',')[0].strip()
    return f'<a href="{href}" target="_blank" rel="noopener">{label}</a>'


def asciidoc_inline(text: str) -> str:
    """Convert inline AsciiDoc markup to HTML."""
    # Unconstrained bold: **text** (must run before constrained)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    # Constrained bold: *text*
    text = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<strong>\1</strong>', text)
    # Italic: _text_
    text = re.sub(r'(?<!_)_([^_]+)_(?!_)', r'<em>\1</em>', text)
    # Monospace: `text`
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    # Links: link:url[label,attr] → strip attributes after first comma
    text = re.sub(r'link:(\S+)\[([^\]]+)\]', _link_repl, text)
    # Template vars: expand known, strip unknown
    text = re.sub(r'\{([a-z0-9_-]+)\}', _expand_template_var, text)
    return text


# ---------------------------------------------------------------------------
# OSCAL parsing
# ---------------------------------------------------------------------------

def parse_component_definition(filepath: str) -> tuple[str, list[dict], str]:
    """Parse a component-definition OSCAL file.

    Returns (component_title, resources_list, last_updated).
    """
    with open(filepath) as f:
        data = json.load(f)
    cd = data["component-definition"]
    comp_title = cd.get("components", [{}])[0].get("title", "Unknown")
    last_updated = cd.get("metadata", {}).get("last-modified", "")[:10]

    resources = cd.get("back-matter", {}).get("resources", [])
    return comp_title, resources, last_updated


def parse_ssp(filepath: str) -> dict:
    """Parse an SSP OSCAL file for governance metadata."""
    with open(filepath) as f:
        data = json.load(f)
    ssp = data["system-security-plan"]
    sc = ssp.get("system-characteristics", {})

    sensitivity = sc.get("security-sensitivity-level", "")
    impact = sc.get("security-impact-level", {})

    return {
        "securitySensitivity": sensitivity,
        "impactLevels": {
            "confidentiality": impact.get("security-objective-confidentiality", ""),
            "integrity": impact.get("security-objective-integrity", ""),
            "availability": impact.get("security-objective-availability", ""),
        } if impact else None,
    }


def build_service_data(prefix: str, service_id: str, display_name: str) -> dict | None:
    """Build RscServiceData for one service from its OSCAL files."""
    cd_file = RSC_DIR / f"{prefix}_oscal_component-definition.json"
    ssp_file = RSC_DIR / f"{prefix}_oscal_ssp.json"

    if not cd_file.exists():
        print(f"  SKIP: {cd_file.name} not found", file=sys.stderr)
        return None

    comp_title, resources, last_updated = parse_component_definition(str(cd_file))

    # Parse SSP for governance metadata
    ssp_meta = {}
    if ssp_file.exists():
        ssp_meta = parse_ssp(str(ssp_file))

    # Extract overview from the Overview resource
    overview = ""
    for r in resources:
        if r.get("title") == "Overview":
            overview = asciidoc_inline(r.get("description", ""))
            break

    # Extract last_updated from Document Information table if available
    for r in resources:
        if r.get("title") == "Document Information":
            desc = r.get("description", "")
            m = re.search(r'Last Updated\s*\|(\d{4}-\d{2}-\d{2})', desc)
            if m:
                last_updated = m.group(1)
            break

    # Build requirements and content hierarchy
    requirements = extract_requirements(resources)

    result: dict[str, Any] = {
        "serviceId": service_id,
        "serviceName": display_name,
        "lastUpdated": last_updated,
        "overview": overview,
        "requirements": requirements,
    }

    if ssp_meta.get("securitySensitivity"):
        result["securitySensitivity"] = ssp_meta["securitySensitivity"]
    if ssp_meta.get("impactLevels"):
        result["impactLevels"] = ssp_meta["impactLevels"]

    return result


def extract_requirements(resources: list[dict]) -> list[dict]:
    """Extract FRR-RSC requirements with their nested content blocks."""
    requirements = []
    i = 0

    while i < len(resources):
        r = resources[i]
        title = r.get("title", "")

        # Match FRR-RSC-NN: Title pattern
        frr_match = re.match(r'(FRR-RSC-\d+):\s*(.+)', title)
        if frr_match:
            req_id = frr_match.group(1)
            req_title = frr_match.group(2).strip()
            desc = r.get("description", "").strip()

            # Check applicability
            applicable = True
            if re.search(r'\*Applicable:\*\s*No', desc, re.IGNORECASE):
                applicable = False

            # Get section level of this FRR resource
            frr_level = get_section_level(r)

            # Collect all blocks: from this resource + child resources
            all_blocks = parse_asciidoc(desc) if desc and applicable else []
            control_ids: list[str] = []

            # Collect control IDs from this resource's content
            control_ids.extend(extract_control_ids(desc))

            # Gather child resources (higher section-level) until next same-or-lower level
            i += 1
            while i < len(resources):
                child = resources[i]
                child_level = get_section_level(child)
                child_title = child.get("title", "")

                # Stop at next FRR-RSC or same/lower level
                if re.match(r'FRR-RSC-\d+:', child_title):
                    break
                if child_level <= frr_level and child_level > 0:
                    # Check if it's a top-level section, not a child
                    # Only break if it's clearly a new top-level section
                    if not is_child_of_frr(child_title):
                        break

                child_desc = child.get("description", "").strip()
                if child_title and child_title != "N/A":
                    all_blocks.append({
                        "type": "heading",
                        "level": min(child_level + 1, 4) if child_level > 0 else 3,
                        "text": child_title,
                    })
                if child_desc:
                    all_blocks.extend(parse_asciidoc(child_desc))
                    control_ids.extend(extract_control_ids(child_desc))
                i += 1

            # Deduplicate control IDs
            seen = set()
            unique_controls = []
            for cid in control_ids:
                if cid not in seen:
                    seen.add(cid)
                    unique_controls.append(cid)

            requirements.append({
                "id": req_id,
                "title": req_title,
                "applicable": applicable,
                "blocks": all_blocks,
                "controlIds": unique_controls,
            })
        else:
            i += 1

    return requirements


def is_child_of_frr(title: str) -> bool:
    """Heuristic: non-FRR titles that appear between FRR sections are children."""
    # Titles like "Additional Resources", "Document Information" are top-level
    top_level = {"Document Information", "Overview", "FedRAMP Requirements", "Additional Resources"}
    return title not in top_level


def get_section_level(resource: dict) -> int:
    """Get section-level prop value, or 0 if not present."""
    for p in resource.get("props", []):
        if p.get("name") == "section-level":
            try:
                return int(p["value"])
            except (ValueError, KeyError):
                pass
    return 0


def extract_control_ids(text: str) -> list[str]:
    """Extract NIST control IDs from various patterns in OSCAL content."""
    ids = []
    # Pattern 1: *Control:* AC-6  or  *Controls:* AC-2, AC-6
    for m in re.finditer(r'\*Controls?:\*\s*(.+)', text):
        raw = m.group(1).strip()
        for part in re.split(r'[,\s]+', raw):
            part = part.strip()
            if re.match(r'^[A-Z]{2}-\d+', part):
                ids.append(part)
    # Pattern 2: *Control Implementation*: AC-2 (Account Management), AC-6 (Least Privilege)
    for m in re.finditer(r'\*Control Implementation\*:\s*(.+)', text):
        raw = m.group(1).strip()
        for part in re.findall(r'([A-Z]{2}-\d+)', raw):
            ids.append(part)
    return ids


# ---------------------------------------------------------------------------
# TypeScript code generation
# ---------------------------------------------------------------------------

def to_ts_string(s: str) -> str:
    """Escape a string for TypeScript template literal or single-quoted string."""
    return s.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


def generate_block_ts(block: dict, indent: str = "      ") -> str:
    """Generate TypeScript for a single content block."""
    btype = block["type"]

    if btype == "heading":
        level = block["level"]
        text = to_ts_string(block["text"])
        return f'{indent}{{ type: "heading", level: {level}, text: `{text}` }}'

    if btype == "text":
        html = to_ts_string(block["html"])
        return f'{indent}{{ type: "text", html: `{html}` }}'

    if btype == "code":
        lang = block["language"]
        code = to_ts_string(block["code"])
        return f'{indent}{{ type: "code", language: "{lang}", code: `{code}` }}'

    if btype == "list":
        items = block["items"]
        ordered = "true" if block["ordered"] else "false"
        items_ts = ", ".join(f"`{to_ts_string(item)}`" for item in items)
        return f'{indent}{{ type: "list", ordered: {ordered}, items: [{items_ts}] }}'

    if btype == "table":
        rows_ts = ", ".join(
            "[" + ", ".join(f"`{to_ts_string(c)}`" for c in row) + "]"
            for row in block.get("rows", [])
        )
        headers = block.get("headers")
        if headers:
            headers_ts = "[" + ", ".join(f"`{to_ts_string(h)}`" for h in headers) + "]"
            return f'{indent}{{ type: "table", headers: {headers_ts}, rows: [{rows_ts}] }}'
        return f'{indent}{{ type: "table", rows: [{rows_ts}] }}'

    return f'{indent}/* unknown block type: {btype} */'


def generate_requirement_ts(req: dict, indent: str = "    ") -> str:
    """Generate TypeScript for a single requirement."""
    blocks_ts = ",\n".join(generate_block_ts(b) for b in req["blocks"])
    controls_ts = ", ".join(f"'{c}'" for c in req["controlIds"])
    applicable = "true" if req["applicable"] else "false"
    title = to_ts_string(req["title"])

    return f"""{indent}{{
{indent}  id: '{req["id"]}',
{indent}  title: `{title}`,
{indent}  applicable: {applicable},
{indent}  controlIds: [{controls_ts}],
{indent}  blocks: [
{blocks_ts},
{indent}  ],
{indent}}}"""


def generate_service_ts(svc: dict) -> str:
    """Generate TypeScript for a single service data object."""
    reqs_ts = ",\n".join(generate_requirement_ts(r) for r in svc["requirements"])
    overview = to_ts_string(svc["overview"])

    parts = [
        f"  '{svc['serviceId']}': {{",
        f"    serviceId: '{svc['serviceId']}',",
        f"    serviceName: '{svc['serviceName']}',",
        f"    lastUpdated: '{svc['lastUpdated']}',",
        f"    overview: `{overview}`,",
    ]

    if svc.get("securitySensitivity"):
        parts.append(f"    securitySensitivity: '{svc['securitySensitivity']}',")

    if svc.get("impactLevels"):
        il = svc["impactLevels"]
        parts.append(f"    impactLevels: {{ confidentiality: '{il['confidentiality']}', integrity: '{il['integrity']}', availability: '{il['availability']}' }},")

    parts.append(f"    requirements: [\n{reqs_ts},\n    ],")
    parts.append("  }")

    return "\n".join(parts)


def main():
    if not RSC_DIR.exists():
        print(f"ERROR: RSC directory not found: {RSC_DIR}", file=sys.stderr)
        sys.exit(1)

    print(f"Parsing OSCAL files from {RSC_DIR}...")
    services = {}

    for prefix, (service_id, display_name) in SERVICE_MAP.items():
        print(f"  Processing {display_name} ({prefix})...")
        svc = build_service_data(prefix, service_id, display_name)
        if svc:
            services[service_id] = svc
            req_count = len(svc["requirements"])
            applicable = sum(1 for r in svc["requirements"] if r["applicable"])
            print(f"    → {req_count} requirements ({applicable} applicable)")

    # Generate TypeScript
    service_entries = ",\n\n".join(generate_service_ts(svc) for svc in services.values())

    ts_content = f"""// AUTO-GENERATED by scripts/transform_aws_rsc.py — do not edit manually
// Source: RSCs/AWS/ OSCAL component-definition + SSP files
// Reference: https://www.fedramp.gov/docs/rev5/balance/secure-configuration-guide/

import type {{ RscServiceData }} from './types';

export const AWS_RSC_DATA: Record<string, RscServiceData> = {{
{service_entries},
}};
"""

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(ts_content)
    print(f"\nGenerated {OUTPUT} ({len(ts_content):,} bytes, {len(services)} services)")


if __name__ == "__main__":
    main()
