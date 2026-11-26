#!/usr/bin/env python3
"""
Extract all HIPAA v1.1 documents.

Extracts:
- CFR regulations (HTML → markdown, already done by download_cfr_html.py)
- OCR guidance PDFs (15 documents)
- FDA guidance PDFs (14 documents)

Uses Docling for PDF extraction.
"""

import os
import sys
import json
from pathlib import Path
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


class HIPAAv11Extractor:
    """Extract HIPAA v1.1 documents."""

    def __init__(self):
        """Initialize extractor."""
        # Setup Docling with timeout protection
        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_ocr = False
        pipeline_options.do_table_structure = True

        self.converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(
                    pipeline_options=pipeline_options,
                    backend=PyPdfiumDocumentBackend
                )
            }
        )

        self.stats = {
            "cfr_html": {"total": 0, "success": 0, "failed": 0},
            "ocr_guidance": {"total": 0, "success": 0, "failed": 0},
            "fda_guidance": {"total": 0, "success": 0, "failed": 0}
        }

    def extract_pdf(self, pdf_path: Path, output_dir: Path, timeout: int = 120) -> bool:
        """Extract a single PDF to markdown and JSON."""
        try:
            # Convert PDF
            result = self.converter.convert(str(pdf_path))

            # Export as markdown
            markdown = result.document.export_to_markdown()

            # Save markdown
            md_path = output_dir / f"{pdf_path.stem}.md"
            with open(md_path, 'w', encoding='utf-8') as f:
                f.write(markdown)

            # Export as JSON (for prepare_hipaa_data.py compatibility)
            doc_json = result.document.export_to_dict()

            # Save JSON
            json_path = output_dir / f"{pdf_path.stem}.json"
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(doc_json, f, indent=2)

            logger.info(f"  ✓ Extracted: {pdf_path.name} → {md_path.name} ({len(markdown)} chars) + JSON")
            return True

        except Exception as e:
            logger.error(f"  ✗ Extraction failed for {pdf_path.name}: {e}")
            return False

    def extract_ocr_guidance(self):
        """Extract OCR guidance PDFs."""
        input_dir = Path("data/hipaa/raw/ocr_guidance")
        output_dir = Path("data/hipaa/extracted/ocr_guidance")
        output_dir.mkdir(parents=True, exist_ok=True)

        pdf_files = list(input_dir.glob("*.pdf"))
        self.stats["ocr_guidance"]["total"] = len(pdf_files)

        logger.info(f"\n{'='*60}")
        logger.info(f"EXTRACTING OCR GUIDANCE PDFs")
        logger.info(f"{'='*60}")
        logger.info(f"PDFs to extract: {len(pdf_files)}")
        logger.info(f"Output: {output_dir}")
        logger.info(f"{'='*60}\n")

        for i, pdf_path in enumerate(pdf_files, 1):
            logger.info(f"[{i}/{len(pdf_files)}] {pdf_path.name}")

            # Skip if already extracted (check for both MD and JSON)
            md_path = output_dir / f"{pdf_path.stem}.md"
            json_path = output_dir / f"{pdf_path.stem}.json"
            if md_path.exists() and json_path.exists() and md_path.stat().st_size > 1000:
                logger.info(f"  ✓ Already extracted: {md_path.name} + JSON")
                self.stats["ocr_guidance"]["success"] += 1
                continue

            if self.extract_pdf(pdf_path, output_dir):
                self.stats["ocr_guidance"]["success"] += 1
            else:
                self.stats["ocr_guidance"]["failed"] += 1

    def extract_fda_guidance(self):
        """Extract FDA guidance PDFs."""
        input_dir = Path("data/hipaa/raw/fda_guidance")
        output_dir = Path("data/hipaa/extracted/fda_guidance")
        output_dir.mkdir(parents=True, exist_ok=True)

        pdf_files = list(input_dir.glob("*.pdf"))
        self.stats["fda_guidance"]["total"] = len(pdf_files)

        logger.info(f"\n{'='*60}")
        logger.info(f"EXTRACTING FDA GUIDANCE PDFs")
        logger.info(f"{'='*60}")
        logger.info(f"PDFs to extract: {len(pdf_files)}")
        logger.info(f"Output: {output_dir}")
        logger.info(f"{'='*60}\n")

        for i, pdf_path in enumerate(pdf_files, 1):
            logger.info(f"[{i}/{len(pdf_files)}] {pdf_path.name}")

            # Skip if already extracted (check for both MD and JSON)
            md_path = output_dir / f"{pdf_path.stem}.md"
            json_path = output_dir / f"{pdf_path.stem}.json"
            if md_path.exists() and json_path.exists() and md_path.stat().st_size > 1000:
                logger.info(f"  ✓ Already extracted: {md_path.name} + JSON")
                self.stats["fda_guidance"]["success"] += 1
                continue

            if self.extract_pdf(pdf_path, output_dir):
                self.stats["fda_guidance"]["success"] += 1
            else:
                self.stats["fda_guidance"]["failed"] += 1

    def copy_cfr_markdown(self):
        """Copy CFR markdown files and create JSON versions (already extracted by download_cfr_html.py)."""
        input_dir = Path("data/hipaa/raw/cfr")
        output_dir = Path("data/hipaa/extracted/cfr")
        output_dir.mkdir(parents=True, exist_ok=True)

        md_files = list(input_dir.glob("*.md"))
        self.stats["cfr_html"]["total"] = len(md_files)

        logger.info(f"\n{'='*60}")
        logger.info(f"COPYING CFR MARKDOWN FILES")
        logger.info(f"{'='*60}")
        logger.info(f"Files to copy: {len(md_files)}")
        logger.info(f"Output: {output_dir}")
        logger.info(f"{'='*60}\n")

        import shutil
        for i, md_path in enumerate(md_files, 1):
            dest_md_path = output_dir / md_path.name
            try:
                # Copy markdown
                shutil.copy2(md_path, dest_md_path)

                # Create simple JSON structure for compatibility
                # Read markdown content
                with open(md_path, 'r', encoding='utf-8') as f:
                    markdown_content = f.read()

                # Create minimal JSON structure (compatible with prepare_hipaa_data.py)
                cfr_json = {
                    "name": md_path.stem,
                    "description": {"logs": []},
                    "main-text": [{"text": markdown_content}]
                }

                # Save JSON
                json_path = output_dir / f"{md_path.stem}.json"
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(cfr_json, f, indent=2)

                logger.info(f"[{i}/{len(md_files)}] ✓ Copied: {md_path.name} + created JSON")
                self.stats["cfr_html"]["success"] += 1
            except Exception as e:
                logger.error(f"[{i}/{len(md_files)}] ✗ Copy failed: {md_path.name}: {e}")
                self.stats["cfr_html"]["failed"] += 1

    def print_summary(self):
        """Print extraction summary."""
        logger.info(f"\n{'='*60}")
        logger.info(f"EXTRACTION SUMMARY")
        logger.info(f"{'='*60}")

        total_docs = 0
        total_success = 0
        total_failed = 0

        for category, stats in self.stats.items():
            logger.info(f"\n{category.upper().replace('_', ' ')}:")
            logger.info(f"  Total:   {stats['total']}")
            logger.info(f"  Success: {stats['success']}")
            logger.info(f"  Failed:  {stats['failed']}")

            total_docs += stats['total']
            total_success += stats['success']
            total_failed += stats['failed']

        logger.info(f"\n{'='*60}")
        logger.info(f"OVERALL:")
        logger.info(f"  Total Documents:   {total_docs}")
        logger.info(f"  Successful:        {total_success}")
        logger.info(f"  Failed:            {total_failed}")
        logger.info(f"  Success Rate:      {total_success/total_docs*100:.1f}%")
        logger.info(f"{'='*60}\n")

        if total_failed == 0:
            logger.info("✅ All HIPAA v1.1 documents extracted successfully!")
        else:
            logger.warning(f"⚠️  {total_failed} documents failed extraction")

        # Save stats
        stats_path = Path("data/hipaa/extracted/extraction_stats_v11.json")
        with open(stats_path, 'w') as f:
            json.dump(self.stats, f, indent=2)
        logger.info(f"\nStats saved: {stats_path}")

    def extract_all(self):
        """Extract all HIPAA v1.1 documents."""
        logger.info(f"\n{'='*60}")
        logger.info(f"HIPAA v1.1 DOCUMENT EXTRACTION")
        logger.info(f"{'='*60}\n")

        # 1. Copy CFR markdown (already extracted as HTML → markdown)
        self.copy_cfr_markdown()

        # 2. Extract OCR guidance PDFs
        self.extract_ocr_guidance()

        # 3. Extract FDA guidance PDFs
        self.extract_fda_guidance()

        # 4. Print summary
        self.print_summary()


def main():
    extractor = HIPAAv11Extractor()
    extractor.extract_all()


if __name__ == "__main__":
    main()
