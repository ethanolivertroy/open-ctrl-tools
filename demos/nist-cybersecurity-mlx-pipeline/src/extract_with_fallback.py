#!/usr/bin/env python3
"""
Hybrid PDF Extraction: Docling + MarkItDown Fallback

Uses Docling as primary extractor (superior structure preservation)
Falls back to MarkItDown if Docling times out or fails.
"""

import argparse
import json
import logging
from pathlib import Path
from typing import Dict, Optional
from tqdm import tqdm
import signal
from contextlib import contextmanager

# Import Docling
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions

# Import MarkItDown
from markitdown import MarkItDown

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class HybridExtractor:
    """Extract PDFs using Docling with MarkItDown fallback."""

    def __init__(self, output_format: str = "both", docling_timeout: int = 120):
        """
        Initialize hybrid extractor.

        Args:
            output_format: Output format - 'markdown', 'json', or 'both'
            docling_timeout: Timeout in seconds for Docling extraction
        """
        self.output_format = output_format
        self.docling_timeout = docling_timeout

        # Initialize Docling
        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_ocr = False
        pipeline_options.do_table_structure = True

        self.docling_converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
            }
        )

        # Initialize MarkItDown
        self.markitdown = MarkItDown()

        # Statistics
        self.stats = {
            'total': 0,
            'docling_success': 0,
            'markitdown_fallback': 0,
            'total_failures': 0,
            'failed_files': []
        }

    @contextmanager
    def time_limit(self, seconds: int):
        """Context manager for timeout."""
        def signal_handler(signum, frame):
            raise TimeoutError(f"Timed out after {seconds} seconds")
        signal.signal(signal.SIGALRM, signal_handler)
        signal.alarm(seconds)
        try:
            yield
        finally:
            signal.alarm(0)

    def extract_with_docling(self, pdf_path: Path) -> Optional[Dict]:
        """
        Extract PDF using Docling with timeout.

        Returns:
            Extracted content dict or None if failed
        """
        try:
            logger.info(f"[Docling] Processing: {pdf_path.name}")

            with self.time_limit(self.docling_timeout):
                result = self.docling_converter.convert(str(pdf_path))
                doc = result.document

                extracted = {
                    'title': pdf_path.stem,
                    'source_file': pdf_path.name,
                    'num_pages': len(doc.pages),
                    'markdown': doc.export_to_markdown(),
                    'extraction_method': 'docling',
                    'sections': self._extract_docling_sections(doc),
                    'tables': self._extract_docling_tables(doc),
                    'metadata': {
                        'has_tables': len(doc.tables) > 0,
                        'has_figures': len(doc.pictures) > 0,
                    }
                }

                logger.info(f"[Docling] Success: {pdf_path.name}")
                self.stats['docling_success'] += 1
                return extracted

        except TimeoutError as e:
            logger.warning(f"[Docling] Timeout ({self.docling_timeout}s): {pdf_path.name}")
            return None
        except Exception as e:
            logger.warning(f"[Docling] Error: {pdf_path.name}: {e}")
            return None

    def extract_with_markitdown(self, pdf_path: Path) -> Optional[Dict]:
        """
        Extract PDF using MarkItDown fallback.

        Returns:
            Extracted content dict or None if failed
        """
        try:
            logger.info(f"[MarkItDown] Fallback processing: {pdf_path.name}")

            result = self.markitdown.convert(str(pdf_path))
            markdown_content = result.text_content

            extracted = {
                'title': pdf_path.stem,
                'source_file': pdf_path.name,
                'num_pages': None,  # MarkItDown doesn't provide page count
                'markdown': markdown_content,
                'extraction_method': 'markitdown',
                'sections': [],  # MarkItDown doesn't extract structured sections
                'tables': [],
                'metadata': {
                    'has_tables': False,
                    'has_figures': False,
                    'fallback_reason': 'docling_timeout_or_error'
                }
            }

            logger.info(f"[MarkItDown] Success: {pdf_path.name}")
            self.stats['markitdown_fallback'] += 1
            return extracted

        except Exception as e:
            logger.error(f"[MarkItDown] Failed: {pdf_path.name}: {e}")
            return None

    def _extract_docling_sections(self, doc) -> list:
        """Extract document sections from Docling output."""
        sections = []
        for item in doc.iterate_items():
            if hasattr(item, 'heading') and item.heading:
                sections.append({
                    'level': getattr(item, 'level', 0),
                    'heading': item.heading,
                    'text': item.text if hasattr(item, 'text') else ''
                })
        return sections

    def _extract_docling_tables(self, doc) -> list:
        """Extract tables from Docling output."""
        tables = []
        for table in doc.tables:
            try:
                tables.append({
                    'caption': getattr(table, 'caption', ''),
                    'data': table.export_to_dict() if hasattr(table, 'export_to_dict') else str(table)
                })
            except Exception as e:
                logger.debug(f"Error extracting table: {e}")
        return tables

    def extract_document(self, pdf_path: Path) -> Optional[Dict]:
        """
        Extract document using hybrid approach.

        1. Try Docling (with timeout)
        2. Fall back to MarkItDown if Docling fails
        3. Return None if both fail

        Returns:
            Extracted content dict or None
        """
        self.stats['total'] += 1

        # Try Docling first
        result = self.extract_with_docling(pdf_path)
        if result:
            return result

        # Fallback to MarkItDown
        result = self.extract_with_markitdown(pdf_path)
        if result:
            return result

        # Both failed
        logger.error(f"[FAILED] Both extractors failed: {pdf_path.name}")
        self.stats['total_failures'] += 1
        self.stats['failed_files'].append(pdf_path.name)
        return None

    def process_directory(self, input_dir: Path, output_dir: Path):
        """
        Process all PDFs in directory with hybrid extraction.

        Args:
            input_dir: Directory containing PDFs
            output_dir: Directory to save extracted content
        """
        output_dir.mkdir(parents=True, exist_ok=True)

        pdf_files = list(input_dir.glob('*.pdf'))
        logger.info(f"Found {len(pdf_files)} PDF files")

        if not pdf_files:
            logger.warning(f"No PDF files found in {input_dir}")
            return

        # Filter out already-processed PDFs
        pdfs_to_process = []
        skipped = 0
        for pdf_path in pdf_files:
            json_path = output_dir / f"{pdf_path.stem}.json"
            if json_path.exists():
                skipped += 1
            else:
                pdfs_to_process.append(pdf_path)

        logger.info(f"Skipping {skipped} already-extracted documents")
        logger.info(f"Processing {len(pdfs_to_process)} remaining documents")

        # Process each PDF
        for pdf_path in tqdm(pdfs_to_process, desc="Extracting documents"):
            extracted = self.extract_document(pdf_path)

            if extracted:
                # Save markdown
                if self.output_format in ['markdown', 'both']:
                    md_path = output_dir / f"{pdf_path.stem}.md"
                    md_path.write_text(extracted['markdown'], encoding='utf-8')

                # Save JSON
                if self.output_format in ['json', 'both']:
                    json_path = output_dir / f"{pdf_path.stem}.json"
                    with open(json_path, 'w', encoding='utf-8') as f:
                        json.dump(extracted, f, indent=2, ensure_ascii=False)

        # Save extraction report
        self._save_report(output_dir)

        logger.info(f"Extraction complete. Processed {self.stats['total']} documents")
        logger.info(f"  Docling: {self.stats['docling_success']}")
        logger.info(f"  MarkItDown fallback: {self.stats['markitdown_fallback']}")
        logger.info(f"  Failed: {self.stats['total_failures']}")

    def _save_report(self, output_dir: Path):
        """Save extraction statistics report."""
        report_path = output_dir / 'extraction_report.json'
        report = {
            **self.stats,
            'success_rate': f"{((self.stats['total'] - self.stats['total_failures']) / self.stats['total'] * 100):.1f}%"
            if self.stats['total'] > 0 else "0%",
            'docling_rate': f"{(self.stats['docling_success'] / self.stats['total'] * 100):.1f}%"
            if self.stats['total'] > 0 else "0%",
            'markitdown_rate': f"{(self.stats['markitdown_fallback'] / self.stats['total'] * 100):.1f}%"
            if self.stats['total'] > 0 else "0%"
        }

        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)

        logger.info(f"Extraction report saved to: {report_path}")


def main():
    parser = argparse.ArgumentParser(
        description='Hybrid PDF extraction with Docling + MarkItDown fallback'
    )
    parser.add_argument('--input', '-i', default='data/raw',
                        help='Input directory containing PDFs')
    parser.add_argument('--output', '-o', default='data/extracted',
                        help='Output directory for extracted content')
    parser.add_argument('--format', '-f', choices=['markdown', 'json', 'both'],
                        default='both',
                        help='Output format')
    parser.add_argument('--timeout', '-t', type=int, default=120,
                        help='Docling timeout in seconds (default: 120)')

    args = parser.parse_args()

    input_dir = Path(args.input)
    output_dir = Path(args.output)

    if not input_dir.exists():
        logger.error(f"Input directory does not exist: {input_dir}")
        return

    extractor = HybridExtractor(
        output_format=args.format,
        docling_timeout=args.timeout
    )
    extractor.process_directory(input_dir, output_dir)


if __name__ == '__main__':
    main()
