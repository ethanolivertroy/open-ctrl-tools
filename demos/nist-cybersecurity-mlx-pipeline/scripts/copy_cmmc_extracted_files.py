#!/usr/bin/env python3
"""
Copy extracted NIST documents for CMMC datasets.

This script copies the relevant .md and .json files from data/extracted/
to the appropriate CMMC variant directories.
"""

import json
import shutil
from pathlib import Path
from typing import List, Dict

def get_extracted_filename(doc: Dict) -> str:
    """
    Get the extracted filename from document metadata.

    Converts:
      data/raw/Some Document.pdf
    To:
      Some Document.md / Some Document.json
    """
    local_path = doc.get("local_path", "")
    if not local_path:
        return ""

    # Extract just the filename without extension
    pdf_name = Path(local_path).stem
    return pdf_name

def copy_variant_files(
    variant_name: str,
    document_list_path: Path,
    extracted_dir: Path,
    output_dir: Path
):
    """Copy extracted files for a specific CMMC variant."""

    print(f"\n{'='*60}")
    print(f"Copying {variant_name.upper()} variant files...")
    print(f"{'='*60}")

    # Load document list
    with open(document_list_path) as f:
        documents = json.load(f)

    print(f"Documents to copy: {len(documents)}")

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    # Track statistics
    copied_md = 0
    copied_json = 0
    missing = []

    # Copy files for each document
    for i, doc in enumerate(documents, 1):
        filename_base = get_extracted_filename(doc)
        if not filename_base:
            print(f"  ⚠️  [{i}/{len(documents)}] No local path for: {doc.get('title', 'Unknown')[:60]}")
            missing.append(doc.get('title', 'Unknown'))
            continue

        # Copy .md file
        md_src = extracted_dir / f"{filename_base}.md"
        md_dst = output_dir / f"{filename_base}.md"

        if md_src.exists():
            shutil.copy2(md_src, md_dst)
            copied_md += 1
        else:
            missing.append(f"{filename_base}.md")

        # Copy .json file
        json_src = extracted_dir / f"{filename_base}.json"
        json_dst = output_dir / f"{filename_base}.json"

        if json_src.exists():
            shutil.copy2(json_src, json_dst)
            copied_json += 1
        else:
            missing.append(f"{filename_base}.json")

        # Progress indicator
        if i % 10 == 0 or i == len(documents):
            print(f"  Progress: {i}/{len(documents)} documents processed")

    # Print summary
    print(f"\n📊 {variant_name.upper()} Summary:")
    print(f"  ✅ Markdown files copied: {copied_md}/{len(documents)}")
    print(f"  ✅ JSON files copied:     {copied_json}/{len(documents)}")

    if missing:
        print(f"  ⚠️  Missing files: {len(missing)}")
        if len(missing) <= 5:
            for m in missing:
                print(f"      - {m}")

    return copied_md, copied_json, missing

def main():
    # Paths
    project_root = Path(__file__).parent.parent
    cmmc_dir = project_root / "data" / "cmmc"
    extracted_dir = project_root / "data" / "extracted"

    # Verify extracted directory exists
    if not extracted_dir.exists():
        print(f"❌ Error: Extracted directory not found: {extracted_dir}")
        return

    print("="*60)
    print("CMMC Extracted Files Copy Script")
    print("="*60)
    print(f"\nSource directory: {extracted_dir}")
    print(f"Output directory: {cmmc_dir}")

    # Copy files for each variant
    variants = [
        ("core", cmmc_dir / "core_documents.json", cmmc_dir / "core" / "extracted"),
        ("balanced", cmmc_dir / "balanced_documents.json", cmmc_dir / "balanced" / "extracted"),
        ("comprehensive", cmmc_dir / "comprehensive_documents.json", cmmc_dir / "comprehensive" / "extracted"),
    ]

    total_copied = {"md": 0, "json": 0}
    all_missing = []

    for variant_name, doc_list, output_dir in variants:
        if not doc_list.exists():
            print(f"\n⚠️  Skipping {variant_name}: Document list not found: {doc_list}")
            continue

        md_count, json_count, missing = copy_variant_files(
            variant_name,
            doc_list,
            extracted_dir,
            output_dir
        )

        total_copied["md"] += md_count
        total_copied["json"] += json_count
        all_missing.extend(missing)

    # Final summary
    print("\n" + "="*60)
    print("FINAL SUMMARY")
    print("="*60)
    print(f"Total Markdown files copied: {total_copied['md']}")
    print(f"Total JSON files copied:     {total_copied['json']}")
    print(f"Total missing files:         {len(all_missing)}")

    if all_missing:
        print(f"\n⚠️  Note: {len(all_missing)} files were not found in extracted/")
        print("   This is normal if extraction hasn't completed for all documents.")

    print(f"\n✅ File copying complete!")
    print(f"\nNext step: Run data preparation scripts to generate training data")

if __name__ == "__main__":
    main()
