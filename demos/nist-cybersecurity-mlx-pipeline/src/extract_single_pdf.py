#!/usr/bin/env python3
"""
Specialized PDF Extractor for Troublesome Documents

This script tries multiple extraction methods in order:
1. MarkItDown (with extended timeout, no Docling)
2. pdfminer.six (direct text extraction)
3. pypdf (basic fallback)

Use this for PDFs that hang or fail with the standard hybrid extractor.
"""

import argparse
import json
import logging
from pathlib import Path
from typing import Dict, Optional

# Import MarkItDown
from markitdown import MarkItDown

# Import pdfminer.six
from pdfminer.high_level import extract_text as pdfminer_extract_text

# Import pypdf
try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SpecializedPDFExtractor:
    """Extracts troublesome PDFs using multiple fallback strategies."""

    def __init__(self):
        self.markitdown = MarkItDown()
        self.stats = {
            'method_used': None,
            'success': False,
            'error': None
        }

    def extract_with_markitdown(self, pdf_path: Path) -> Optional[Dict]:
        """
        Method 1: Try MarkItDown directly (skip Docling entirely).
        """
        try:
            logger.info(f"[Method 1] Trying MarkItDown: {pdf_path.name}")

            result = self.markitdown.convert(str(pdf_path))
            markdown_content = result.text_content

            if not markdown_content or len(markdown_content.strip()) < 100:
                logger.warning(f"[Method 1] MarkItDown returned insufficient content")
                return None

            extracted = {
                'title': pdf_path.stem,
                'source_file': pdf_path.name,
                'num_pages': None,
                'markdown': markdown_content,
                'extraction_method': 'markitdown_direct',
                'sections': [],
                'tables': [],
                'metadata': {
                    'has_tables': False,
                    'has_figures': False,
                    'extraction_note': 'Direct MarkItDown extraction (no Docling)'
                }
            }

            logger.info(f"[Method 1] Success: {len(markdown_content)} characters extracted")
            self.stats['method_used'] = 'markitdown_direct'
            self.stats['success'] = True
            return extracted

        except Exception as e:
            logger.warning(f"[Method 1] MarkItDown failed: {e}")
            return None

    def extract_with_pdfminer(self, pdf_path: Path) -> Optional[Dict]:
        """
        Method 2: Try pdfminer.six for direct text extraction.
        """
        try:
            logger.info(f"[Method 2] Trying pdfminer.six: {pdf_path.name}")

            text_content = pdfminer_extract_text(str(pdf_path))

            if not text_content or len(text_content.strip()) < 100:
                logger.warning(f"[Method 2] pdfminer returned insufficient content")
                return None

            # Convert to markdown-like format
            markdown_content = f"# {pdf_path.stem}\n\n{text_content}"

            extracted = {
                'title': pdf_path.stem,
                'source_file': pdf_path.name,
                'num_pages': None,
                'markdown': markdown_content,
                'extraction_method': 'pdfminer',
                'sections': [],
                'tables': [],
                'metadata': {
                    'has_tables': False,
                    'has_figures': False,
                    'extraction_note': 'Basic text extraction via pdfminer.six'
                }
            }

            logger.info(f"[Method 2] Success: {len(text_content)} characters extracted")
            self.stats['method_used'] = 'pdfminer'
            self.stats['success'] = True
            return extracted

        except Exception as e:
            logger.warning(f"[Method 2] pdfminer failed: {e}")
            return None

    def extract_with_pypdf(self, pdf_path: Path) -> Optional[Dict]:
        """
        Method 3: Try pypdf as last resort.
        """
        if PdfReader is None:
            logger.warning("[Method 3] pypdf not available")
            return None

        try:
            logger.info(f"[Method 3] Trying pypdf: {pdf_path.name}")

            reader = PdfReader(str(pdf_path))
            text_parts = []

            for page_num, page in enumerate(reader.pages, 1):
                try:
                    text = page.extract_text()
                    if text:
                        text_parts.append(f"--- Page {page_num} ---\n{text}")
                except Exception as e:
                    logger.warning(f"[Method 3] Failed to extract page {page_num}: {e}")

            text_content = "\n\n".join(text_parts)

            if not text_content or len(text_content.strip()) < 100:
                logger.warning(f"[Method 3] pypdf returned insufficient content")
                return None

            # Convert to markdown
            markdown_content = f"# {pdf_path.stem}\n\n{text_content}"

            extracted = {
                'title': pdf_path.stem,
                'source_file': pdf_path.name,
                'num_pages': len(reader.pages),
                'markdown': markdown_content,
                'extraction_method': 'pypdf',
                'sections': [],
                'tables': [],
                'metadata': {
                    'has_tables': False,
                    'has_figures': False,
                    'extraction_note': 'Basic text extraction via pypdf'
                }
            }

            logger.info(f"[Method 3] Success: {len(text_content)} characters from {len(reader.pages)} pages")
            self.stats['method_used'] = 'pypdf'
            self.stats['success'] = True
            return extracted

        except Exception as e:
            logger.warning(f"[Method 3] pypdf failed: {e}")
            return None

    def extract_pdf(self, pdf_path: Path) -> Optional[Dict]:
        """
        Try all extraction methods in sequence until one succeeds.
        """
        logger.info(f"Starting specialized extraction for: {pdf_path.name}")
        logger.info(f"File size: {pdf_path.stat().st_size / 1024:.1f} KB")

        # Try Method 1: MarkItDown
        result = self.extract_with_markitdown(pdf_path)
        if result:
            return result

        # Try Method 2: pdfminer.six
        result = self.extract_with_pdfminer(pdf_path)
        if result:
            return result

        # Try Method 3: pypdf
        result = self.extract_with_pypdf(pdf_path)
        if result:
            return result

        # All methods failed
        logger.error(f"[FAILED] All extraction methods failed for: {pdf_path.name}")
        self.stats['success'] = False
        self.stats['error'] = 'All extraction methods failed'
        return None

    def save_extraction(self, extracted: Dict, output_dir: Path, output_format: str = 'both'):
        """Save extracted content to files."""
        output_dir.mkdir(parents=True, exist_ok=True)

        stem = extracted['title']

        # Save markdown
        if output_format in ['markdown', 'both']:
            md_path = output_dir / f"{stem}.md"
            md_path.write_text(extracted['markdown'], encoding='utf-8')
            logger.info(f"Saved markdown: {md_path}")

        # Save JSON
        if output_format in ['json', 'both']:
            json_path = output_dir / f"{stem}.json"
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(extracted, f, indent=2, ensure_ascii=False)
            logger.info(f"Saved JSON: {json_path}")


def main():
    parser = argparse.ArgumentParser(
        description='Specialized extractor for troublesome PDF documents'
    )
    parser.add_argument('pdf_path', help='Path to the PDF file')
    parser.add_argument('--output', '-o', default='data/extracted',
                        help='Output directory for extracted content')
    parser.add_argument('--format', '-f', choices=['markdown', 'json', 'both'],
                        default='both',
                        help='Output format')

    args = parser.parse_args()

    pdf_path = Path(args.pdf_path)
    output_dir = Path(args.output)

    if not pdf_path.exists():
        logger.error(f"PDF file not found: {pdf_path}")
        return 1

    extractor = SpecializedPDFExtractor()
    extracted = extractor.extract_pdf(pdf_path)

    if extracted:
        extractor.save_extraction(extracted, output_dir, args.format)
        logger.info(f"✓ Extraction successful using: {extractor.stats['method_used']}")
        return 0
    else:
        logger.error(f"✗ Extraction failed for: {pdf_path.name}")
        logger.error(f"  Error: {extractor.stats['error']}")
        return 1


if __name__ == '__main__':
    exit(main())
