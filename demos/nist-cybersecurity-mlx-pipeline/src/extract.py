#!/usr/bin/env python3
"""
NIST Document Extraction using Docling

Extracts structured content from NIST PDFs using Docling's advanced parsing.
"""

import argparse
import json
import logging
from pathlib import Path
from typing import List, Dict
from tqdm import tqdm

from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class NISTDocumentExtractor:
    """Extract and structure content from NIST PDFs using Docling."""

    def __init__(self, output_format: str = "markdown"):
        """
        Initialize extractor.

        Args:
            output_format: Output format - 'markdown', 'json', or 'both'
        """
        self.output_format = output_format

        # Configure Docling pipeline for optimal PDF parsing
        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_ocr = False  # NIST PDFs are typically text-based
        pipeline_options.do_table_structure = True  # Extract table structures

        # Initialize document converter with format options
        self.converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
            }
        )

    def extract_document(self, pdf_path: Path, timeout: int = 120) -> Dict:
        """
        Extract content from a single PDF with timeout.

        Args:
            pdf_path: Path to PDF file
            timeout: Maximum seconds to spend on one document

        Returns:
            Dictionary with extracted content and metadata
        """
        import signal
        from contextlib import contextmanager

        @contextmanager
        def time_limit(seconds):
            def signal_handler(signum, frame):
                raise TimeoutError(f"Timed out after {seconds} seconds")
            signal.signal(signal.SIGALRM, signal_handler)
            signal.alarm(seconds)
            try:
                yield
            finally:
                signal.alarm(0)

        try:
            logger.info(f"Processing: {pdf_path.name}")

            # Convert document with timeout
            with time_limit(timeout):
                result = self.converter.convert(str(pdf_path))

                # Get document content
                doc = result.document

                # Extract structured information
                extracted = {
                    'title': pdf_path.stem,
                    'source_file': pdf_path.name,
                    'num_pages': len(doc.pages),
                    'markdown': doc.export_to_markdown(),
                    'sections': self._extract_sections(doc),
                    'tables': self._extract_tables(doc),
                    'metadata': {
                        'has_tables': len(doc.tables) > 0,
                        'has_figures': len(doc.pictures) > 0,
                    }
                }

                return extracted

        except TimeoutError as e:
            logger.warning(f"Timeout processing {pdf_path.name}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error processing {pdf_path.name}: {e}")
            return None

    def _extract_sections(self, doc) -> List[Dict]:
        """Extract document sections with hierarchy."""
        sections = []

        for item in doc.iterate_items():
            if hasattr(item, 'heading') and item.heading:
                sections.append({
                    'level': getattr(item, 'level', 0),
                    'heading': item.heading,
                    'text': item.text if hasattr(item, 'text') else ''
                })

        return sections

    def _extract_tables(self, doc) -> List[Dict]:
        """Extract tables from document."""
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

    def process_directory(self, input_dir: Path, output_dir: Path):
        """
        Process all PDFs in a directory.

        Args:
            input_dir: Directory containing PDFs
            output_dir: Directory to save extracted content
        """
        output_dir.mkdir(parents=True, exist_ok=True)

        # Find all PDF files
        pdf_files = list(input_dir.glob('*.pdf'))
        logger.info(f"Found {len(pdf_files)} PDF files")

        if not pdf_files:
            logger.warning(f"No PDF files found in {input_dir}")
            return

        # Process each PDF
        results = []
        for pdf_path in tqdm(pdf_files, desc="Extracting documents"):
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

                results.append({
                    'source_file': extracted['source_file'],
                    'title': extracted['title'],
                    'num_pages': extracted['num_pages'],
                    'has_tables': extracted['metadata']['has_tables'],
                    'has_figures': extracted['metadata']['has_figures'],
                })

        # Save processing summary
        summary_path = output_dir / 'extraction_summary.json'
        with open(summary_path, 'w') as f:
            json.dump({
                'total_processed': len(results),
                'documents': results
            }, f, indent=2)

        logger.info(f"Extraction complete. Processed {len(results)} documents")
        logger.info(f"Output saved to: {output_dir}")


def main():
    parser = argparse.ArgumentParser(
        description='Extract content from NIST PDFs using Docling'
    )
    parser.add_argument('--input', '-i', default='data/raw',
                        help='Input directory containing PDFs')
    parser.add_argument('--output', '-o', default='data/extracted',
                        help='Output directory for extracted content')
    parser.add_argument('--format', '-f', choices=['markdown', 'json', 'both'],
                        default='both',
                        help='Output format')

    args = parser.parse_args()

    input_dir = Path(args.input)
    output_dir = Path(args.output)

    if not input_dir.exists():
        logger.error(f"Input directory does not exist: {input_dir}")
        return

    extractor = NISTDocumentExtractor(output_format=args.format)
    extractor.process_directory(input_dir, output_dir)


if __name__ == '__main__':
    main()
