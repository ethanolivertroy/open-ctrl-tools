#!/usr/bin/env python3
"""Validate crosswalk mapping data for consistency and correctness."""

import sys

from lib.io import load_json
from lib.paths import DATA_DIR
from lib.slugify import slugify_control_id as slugify

# Known family/category-level references that are intentional (not control IDs)
KNOWN_FAMILY_REFS = {
    "nist-800-53-r5": {"PT", "CP", "IR"},
    "nist-csf-v2": {
        "DE", "DE.AE", "DE.CM",
        "GV", "GV.OC", "GV.OV", "GV.PO", "GV.RM", "GV.RR", "GV.SC",
        "ID.AM",
        "PR.AA", "PR.AT", "PR.DS", "PR.IR", "PR.PS",
        "RC", "RC.CO", "RC.RP",
        "RS", "RS.AN", "RS.CO", "RS.MA", "RS.MI",
    },
}


def load_framework_slugs(filename: str) -> set[str]:
    """Load a framework JSON and return the set of slugified control IDs."""
    data = load_json(DATA_DIR / filename)
    return {slugify(c["control_id"]) for c in data["controls"]}


def _validate_bidirectional_crosswalk(
    fwd: dict[str, list[str]],
    rev: dict[str, list[str]],
    fwd_label: str,
    rev_label: str,
    metadata: dict,
    metadata_counts: list[tuple[str, dict[str, list[str]]]],
    id_checks: list[tuple[str, set[str], str, set[str] | None]],
) -> list[str]:
    """Validate a bidirectional crosswalk.

    Args:
        fwd/rev: Forward and reverse mapping dicts.
        fwd_label/rev_label: Human-readable names for error messages.
        metadata: The metadata dict from the crosswalk JSON.
        metadata_counts: List of (metadata_key, mapping_dict) to validate counts.
        id_checks: List of (label, all_ids, framework_file, known_family_refs) for
                   validating that IDs resolve to framework controls.
    """
    errors: list[str] = []

    # 1. Bidirectional consistency
    for a_id, b_ids in fwd.items():
        for b_id in b_ids:
            if a_id not in rev.get(b_id, []):
                errors.append(
                    f"Missing reverse: {a_id} -> {b_id}, "
                    f"but {b_id} does not map back to {a_id}"
                )

    for b_id, a_ids in rev.items():
        for a_id in a_ids:
            if b_id not in fwd.get(a_id, []):
                errors.append(
                    f"Missing reverse: {b_id} -> {a_id}, "
                    f"but {a_id} does not map back to {b_id}"
                )

    # 2. Metadata matches actual counts
    total_fwd = sum(len(v) for v in fwd.values())
    if total_fwd != metadata["total_mappings"]:
        errors.append(
            f"Metadata total_mappings ({metadata['total_mappings']}) "
            f"!= actual ({total_fwd})"
        )
    for meta_key, mapping_dict in metadata_counts:
        if len(mapping_dict) != metadata[meta_key]:
            errors.append(
                f"Metadata {meta_key} ({metadata[meta_key]}) "
                f"!= actual ({len(mapping_dict)})"
            )

    # 3. All IDs resolve to framework controls (or are known family/category refs)
    for label, all_ids, fw_file, known_refs in id_checks:
        slugs = load_framework_slugs(fw_file)
        for ctrl_id in sorted(all_ids):
            if known_refs and ctrl_id in known_refs:
                continue
            if slugify(ctrl_id) not in slugs:
                errors.append(f"{label} '{ctrl_id}' does not resolve to a framework control")

    return errors


def validate_csf_nist_crosswalk() -> list[str]:
    """Validate the CSF 2.0 ↔ NIST 800-53 crosswalk."""
    xwalk_path = DATA_DIR / "csf-nist-crosswalk.json"
    if not xwalk_path.exists():
        return ["csf-nist-crosswalk.json not found"]

    xwalk = load_json(xwalk_path)

    csf_to_nist = xwalk["csf_to_nist"]
    nist_to_csf = xwalk["nist_to_csf"]

    all_nist_ids = {nid for nids in csf_to_nist.values() for nid in nids}
    all_nist_ids.update(nist_to_csf.keys())
    all_csf_ids = set(csf_to_nist.keys()).union(*nist_to_csf.values())

    return _validate_bidirectional_crosswalk(
        fwd=csf_to_nist,
        rev=nist_to_csf,
        fwd_label="CSF",
        rev_label="NIST",
        metadata=xwalk["metadata"],
        metadata_counts=[
            ("csf_subcategories", csf_to_nist),
            ("nist_controls", nist_to_csf),
        ],
        id_checks=[
            ("NIST ID", all_nist_ids, "nist-800-53-r5.json", KNOWN_FAMILY_REFS["nist-800-53-r5"]),
            ("CSF ID", all_csf_ids, "nist-csf-v2.json", KNOWN_FAMILY_REFS["nist-csf-v2"]),
        ],
    )


def validate_csf_iso_crosswalk() -> list[str]:
    """Validate the CSF 2.0 ↔ ISO 27001:2022 crosswalk."""
    xwalk_path = DATA_DIR / "csf-iso-crosswalk.json"
    if not xwalk_path.exists():
        return ["csf-iso-crosswalk.json not found"]

    xwalk = load_json(xwalk_path)

    iso_to_csf = xwalk["iso_to_csf"]
    csf_to_iso = xwalk["csf_to_iso"]

    all_iso_ids = set(iso_to_csf.keys()).union(*csf_to_iso.values())
    all_csf_ids = set(csf_to_iso.keys()).union(*iso_to_csf.values())

    id_checks: list[tuple[str, set[str], str, set[str] | None]] = [
        ("CSF ID", all_csf_ids, "nist-csf-v2.json", KNOWN_FAMILY_REFS["nist-csf-v2"]),
    ]
    if (DATA_DIR / "local" / "iso-27001-2022.json").exists():
        id_checks.insert(0, ("ISO ID", all_iso_ids, "local/iso-27001-2022.json", None))
    elif (DATA_DIR / "iso-27001-2022.json").exists():
        id_checks.insert(0, ("ISO ID", all_iso_ids, "iso-27001-2022.json", None))

    return _validate_bidirectional_crosswalk(
        fwd=iso_to_csf,
        rev=csf_to_iso,
        fwd_label="ISO",
        rev_label="CSF",
        metadata=xwalk["metadata"],
        metadata_counts=[
            ("iso_controls", iso_to_csf),
            ("csf_elements", csf_to_iso),
        ],
        id_checks=id_checks,
    )


def _run_validation(label: str, validation_func) -> list[str]:
    """Run a validation function and print results."""
    print(f"  {label}...", end=" ")
    errors = validation_func()
    if errors:
        print(f"FAILED ({len(errors)} errors)")
        for e in errors:
            print(f"    - {e}")
    else:
        print("OK")
    return errors


def main() -> int:
    print("Validating crosswalk mappings...")
    print()

    all_errors = []
    all_errors.extend(_run_validation("CSF 2.0 ↔ NIST 800-53", validate_csf_nist_crosswalk))
    all_errors.extend(_run_validation("CSF 2.0 ↔ ISO 27001:2022", validate_csf_iso_crosswalk))

    print()
    if all_errors:
        print(f"FAILED: {len(all_errors)} error(s) found")
        return 1
    else:
        print("All crosswalk validations passed.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
