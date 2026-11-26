#!/usr/bin/env python3
"""
Download CFR regulations from eCFR.gov (HTML format).

Extracts:
- 45 CFR Parts 160, 162, 164 (HIPAA regulations)
- 21 CFR Part 11 (FDA electronic records/signatures)

HTML extraction is cleaner and more reliable than PDF parsing for CFR content.
"""

import os
import sys
import json
import time
import requests
from pathlib import Path
from bs4 import BeautifulSoup
from typing import Dict, List
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


class CFRDownloader:
    """Download and extract CFR regulations from eCFR.gov."""

    # CFR parts to download
    CFR_PARTS = [
        {
            "id": "45cfr160",
            "title": "45 CFR Part 160 - General Administrative Requirements",
            "url": "https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-160",
            "filename": "45cfr160.html",
            "regulation_type": "HIPAA",
            "topics": ["definitions", "applicability", "compliance", "penalties"]
        },
        {
            "id": "45cfr162",
            "title": "45 CFR Part 162 - Administrative Requirements (Electronic Transactions)",
            "url": "https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-162",
            "filename": "45cfr162.html",
            "regulation_type": "HIPAA",
            "topics": ["transactions", "code sets", "identifiers", "operating rules"]
        },
        {
            "id": "45cfr164",
            "title": "45 CFR Part 164 - Security and Privacy",
            "url": "https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164",
            "filename": "45cfr164.html",
            "regulation_type": "HIPAA",
            "topics": ["Security Rule", "Privacy Rule", "Breach Notification", "Enforcement"]
        },
        {
            "id": "21cfr11",
            "title": "21 CFR Part 11 - Electronic Records; Electronic Signatures",
            "url": "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11",
            "filename": "21cfr11.html",
            "regulation_type": "FDA",
            "topics": ["electronic records", "electronic signatures", "validation", "audit trails"]
        }
    ]

    def __init__(self, output_dir: str = "data/hipaa/raw/cfr"):
        """Initialize downloader."""
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Educational Research Project - HIPAA Compliance Dataset)'
        })

        self.metadata = {
            "source": "eCFR.gov",
            "download_date": None,
            "total_parts": len(self.CFR_PARTS),
            "parts": []
        }

    def download_html(self, part: Dict) -> bool:
        """Download HTML content for a CFR part."""
        output_path = self.output_dir / part["filename"]

        # Skip if already exists and valid
        if output_path.exists() and output_path.stat().st_size > 10000:  # > 10KB
            logger.info(f"✓ {part['filename']} already exists ({output_path.stat().st_size / 1024:.1f} KB)")

            # Still parse for metadata
            with open(output_path, 'r', encoding='utf-8') as f:
                html_content = f.read()

            sections = self._count_sections(html_content)

            self.metadata["parts"].append({
                **part,
                "downloaded": True,
                "file_size_bytes": output_path.stat().st_size,
                "file_path": str(output_path),
                "sections_found": sections
            })
            return True

        logger.info(f"Downloading {part['title']}...")
        logger.info(f"  URL: {part['url']}")

        try:
            response = self.session.get(part["url"], timeout=30)
            response.raise_for_status()

            # Save HTML
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(response.text)

            file_size = output_path.stat().st_size
            logger.info(f"  ✓ Downloaded {file_size / 1024:.1f} KB")

            # Count sections in HTML
            sections = self._count_sections(response.text)
            logger.info(f"  ✓ Found {sections} sections")

            # Also save as markdown
            markdown_path = self.output_dir / part["filename"].replace(".html", ".md")
            markdown = self._convert_to_markdown(response.text, part["title"])
            with open(markdown_path, 'w', encoding='utf-8') as f:
                f.write(markdown)
            logger.info(f"  ✓ Converted to markdown: {markdown_path.name}")

            self.metadata["parts"].append({
                **part,
                "downloaded": True,
                "file_size_bytes": file_size,
                "file_path": str(output_path),
                "markdown_path": str(markdown_path),
                "sections_found": sections
            })

            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"  ✗ Download failed: {e}")
            self.metadata["parts"].append({
                **part,
                "downloaded": False,
                "error": str(e)
            })
            return False

    def _count_sections(self, html: str) -> int:
        """Count CFR sections in HTML."""
        soup = BeautifulSoup(html, 'html.parser')

        # Look for section headings (usually h4 or h5 with section numbers)
        sections = soup.find_all(['h4', 'h5'], class_=lambda x: x and 'section' in x.lower())
        if not sections:
            # Fallback: look for any heading with § symbol
            sections = soup.find_all(string=lambda text: text and '§' in text)

        return len(sections)

    def _convert_to_markdown(self, html: str, title: str) -> str:
        """Convert eCFR HTML to clean markdown."""
        soup = BeautifulSoup(html, 'html.parser')

        # Start with title
        markdown = f"# {title}\n\n"
        markdown += f"**Source**: eCFR.gov (Electronic Code of Federal Regulations)\n\n"
        markdown += f"**Note**: This is the current version as of download date.\n\n"
        markdown += "---\n\n"

        # Find main content div
        content = soup.find('div', {'id': 'content-wrapper'}) or soup.find('main')

        if not content:
            logger.warning("Could not find main content div, using body")
            content = soup.find('body')

        # Extract sections
        sections = content.find_all(['div', 'section'], class_=lambda x: x and ('section' in str(x).lower() or 'subpart' in str(x).lower()))

        if not sections:
            # Fallback: extract all text
            markdown += content.get_text(separator='\n\n', strip=True)
        else:
            for section in sections:
                # Get section heading
                heading = section.find(['h4', 'h5', 'h3'])
                if heading:
                    heading_text = heading.get_text(strip=True)
                    markdown += f"## {heading_text}\n\n"

                # Get section text
                paragraphs = section.find_all('p')
                for p in paragraphs:
                    text = p.get_text(separator=' ', strip=True)
                    if text:
                        markdown += f"{text}\n\n"

                # Add separator between sections
                markdown += "---\n\n"

        return markdown

    def download_all(self, delay: float = 2.0):
        """Download all CFR parts."""
        from datetime import datetime
        self.metadata["download_date"] = datetime.now().isoformat()

        logger.info(f"\n{'='*60}")
        logger.info(f"CFR DOWNLOADER (eCFR.gov HTML)")
        logger.info(f"{'='*60}")
        logger.info(f"Parts to download: {len(self.CFR_PARTS)}")
        logger.info(f"Output directory: {self.output_dir}")
        logger.info(f"{'='*60}\n")

        successful = 0
        failed = 0

        for i, part in enumerate(self.CFR_PARTS, 1):
            logger.info(f"[{i}/{len(self.CFR_PARTS)}] {part['id']}")

            if self.download_html(part):
                successful += 1
            else:
                failed += 1

            # Be polite - delay between downloads
            if i < len(self.CFR_PARTS):
                time.sleep(delay)

        # Save metadata
        metadata_path = self.output_dir / "cfr_metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(self.metadata, f, indent=2)

        logger.info(f"\n{'='*60}")
        logger.info(f"DOWNLOAD SUMMARY")
        logger.info(f"{'='*60}")
        logger.info(f"Successful: {successful}/{len(self.CFR_PARTS)}")
        logger.info(f"Failed: {failed}/{len(self.CFR_PARTS)}")
        logger.info(f"\nMetadata saved: {metadata_path}")
        logger.info(f"{'='*60}\n")

        if failed == 0:
            logger.info("✅ All CFR parts downloaded successfully!")
            logger.info("\nNext steps:")
            logger.info("1. The HTML files have been converted to markdown")
            logger.info("2. Use these markdown files in your HIPAA data preparation")
            logger.info("3. Run: python src/prepare_hipaa_data.py --input data/hipaa/extracted --output data/hipaa/training")

        return successful, failed


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Download CFR regulations from eCFR.gov (HTML format)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Download all CFR parts
  python scripts/download_cfr_html.py

  # Download to custom directory
  python scripts/download_cfr_html.py --output data/hipaa/raw/cfr

  # Adjust delay between downloads
  python scripts/download_cfr_html.py --delay 3.0
"""
    )

    parser.add_argument(
        "--output",
        type=str,
        default="data/hipaa/raw/cfr",
        help="Output directory (default: data/hipaa/raw/cfr)"
    )

    parser.add_argument(
        "--delay",
        type=float,
        default=2.0,
        help="Delay between downloads in seconds (default: 2.0)"
    )

    args = parser.parse_args()

    downloader = CFRDownloader(output_dir=args.output)
    successful, failed = downloader.download_all(delay=args.delay)

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
