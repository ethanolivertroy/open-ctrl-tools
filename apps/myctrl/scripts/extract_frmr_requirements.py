#!/usr/bin/env python3
"""
Extract FRMR requirements (MUST/SHOULD/MAY) from FRMR.documentation.json.
Source: https://github.com/FedRAMP/docs/blob/main/FRMR.documentation.json

Maps FRMR process codes to KSI IDs for the AFR family:
  KSI-AFR-ADS → process ADS, KSI-AFR-CCM → process CCM, etc.

Also includes the generic KSI-level requirements from FRR.KSI.

Outputs: src/data/fedramp-20x-requirements.json
"""

import json
import requests
from pathlib import Path

FRMR_URL = "https://raw.githubusercontent.com/FedRAMP/docs/main/FRMR.documentation.json"
OUTPUT_PATH = Path(__file__).parent.parent / "src" / "data" / "fedramp-20x-requirements.json"


def fetch_frmr_data() -> dict:
    """Fetch FRMR documentation JSON from GitHub."""
    print(f"Fetching: {FRMR_URL}")
    resp = requests.get(FRMR_URL, timeout=30)
    resp.raise_for_status()
    return resp.json()


def extract_requirement(req_id: str, req: dict) -> dict:
    """Extract a single requirement into our format."""
    entry = {
        "id": req_id,
        "name": req.get("name", ""),
        "statement": req.get("statement", "").strip(),
        "keyword": req.get("primary_key_word", "UNKNOWN"),
        "affects": req.get("affects", []),
        "terms": req.get("terms", []),
    }

    if req.get("following_information"):
        entry["followingInformation"] = req["following_information"]

    if req.get("notes"):
        entry["notes"] = req["notes"]

    if req.get("varies_by_level"):
        entry["variesByLevel"] = req["varies_by_level"]

    return entry


def extract_varies_by_level_requirement(req_id: str, req: dict) -> dict:
    """Extract a requirement that has no top-level statement, only varies_by_level.

    Uses moderate level as default (most common FedRAMP baseline), with the full
    varies_by_level data preserved for UI rendering.
    """
    vbl = req["varies_by_level"]

    # Pick moderate as default; fall back to high, then low
    default_level = vbl.get("moderate") or vbl.get("high") or vbl.get("low", {})

    entry = {
        "id": req_id,
        "name": req.get("name", ""),
        "statement": default_level.get("statement", "").strip(),
        "keyword": default_level.get("primary_key_word", "UNKNOWN"),
        "affects": req.get("affects", []),
        "terms": req.get("terms", []),
        "variesByLevel": vbl,
    }

    if req.get("following_information"):
        entry["followingInformation"] = req["following_information"]

    if req.get("notes"):
        entry["notes"] = req["notes"]

    return entry


def extract_process_requirements(proc_data: dict) -> list:
    """Extract all requirements from a process's data (20x + both scopes, skip rev5)."""
    requirements = []

    for scope in ["20x", "both"]:
        scope_data = proc_data.get(scope, {})
        for sub_key, sub_val in scope_data.items():
            if not isinstance(sub_val, dict):
                continue
            for req_id, req in sub_val.items():
                if not isinstance(req, dict):
                    continue

                if "statement" in req:
                    entry = extract_requirement(req_id, req)
                elif "varies_by_level" in req:
                    entry = extract_varies_by_level_requirement(req_id, req)
                else:
                    continue

                entry["scope"] = scope
                requirements.append(entry)

    return requirements


def main():
    data = fetch_frmr_data()
    frr = data.get("FRR", {})

    # Map process codes to requirements
    process_map = {}
    for proc_code, proc in frr.items():
        if not isinstance(proc, dict) or "data" not in proc:
            continue
        reqs = extract_process_requirements(proc["data"])
        if reqs:
            process_map[proc_code] = {
                "processCode": proc_code,
                "requirements": reqs,
                "counts": {
                    "MUST": sum(1 for r in reqs if r["keyword"] == "MUST"),
                    "MUST NOT": sum(1 for r in reqs if r["keyword"] == "MUST NOT"),
                    "SHOULD": sum(1 for r in reqs if r["keyword"] == "SHOULD"),
                    "SHOULD NOT": sum(1 for r in reqs if r["keyword"] == "SHOULD NOT"),
                    "MAY": sum(1 for r in reqs if r["keyword"] == "MAY"),
                },
            }

    total_reqs = sum(len(p["requirements"]) for p in process_map.values())

    output = {
        "_meta": {
            "source": FRMR_URL,
            "description": "FedRAMP FRMR requirements extracted from FRR (20x + both scopes, excluding rev5)",
            "processCount": len(process_map),
            "requirementCount": total_reqs,
        },
        "processes": process_map,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Wrote {total_reqs} requirements across {len(process_map)} processes to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
