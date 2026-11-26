#!/usr/bin/env python3
"""
Download HIPAA compliance documents from federal sources.

Downloads 12 core documents:
- 3 CFR regulations (Parts 160, 162, 164)
- 5 Federal Register preambles
- 1 NIST publication (SP 800-66 Rev. 2)
- 3 FDA guidance documents

All sources are U.S. Federal Government works (public domain).
"""

import os
import sys
import json
import time
import requests
from pathlib import Path
from typing import Dict, List
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


class HIPAADocumentDownloader:
    """Download HIPAA compliance documents from federal sources."""

    # Document inventory with direct download URLs
    DOCUMENTS = [
        # Federal Regulations (45 CFR)
        {
            "id": "45cfr160",
            "title": "45 CFR Part 160 - General Administrative Requirements",
            "url": "https://www.govinfo.gov/content/pkg/CFR-2024-title45-vol1/pdf/CFR-2024-title45-vol1-part160.pdf",
            "filename": "45cfr160.pdf",
            "source": "govinfo.gov",
            "document_type": "regulation",
            "estimated_pages": 45,
            "topics": ["definitions", "applicability", "compliance procedures"]
        },
        {
            "id": "45cfr162",
            "title": "45 CFR Part 162 - Administrative Requirements (Electronic Transactions)",
            "url": "https://www.govinfo.gov/content/pkg/CFR-2024-title45-vol1/pdf/CFR-2024-title45-vol1-part162.pdf",
            "filename": "45cfr162.pdf",
            "source": "govinfo.gov",
            "document_type": "regulation",
            "estimated_pages": 35,
            "topics": ["standard transactions", "code sets", "identifiers"]
        },
        {
            "id": "45cfr164",
            "title": "45 CFR Part 164 - Security and Privacy",
            "url": "https://www.govinfo.gov/content/pkg/CFR-2024-title45-vol1/pdf/CFR-2024-title45-vol1-part164.pdf",
            "filename": "45cfr164.pdf",
            "source": "govinfo.gov",
            "document_type": "regulation",
            "estimated_pages": 105,
            "topics": ["Security Rule", "Privacy Rule", "Breach Notification"]
        },

        # Federal Register Preambles
        {
            "id": "security_rule_2003",
            "title": "Security Rule Final Rule (2003)",
            "url": "https://www.govinfo.gov/content/pkg/FR-2003-02-20/pdf/03-3877.pdf",
            "filename": "security_rule_2003.pdf",
            "source": "govinfo.gov",
            "document_type": "preamble",
            "estimated_pages": 105,
            "topics": ["Security standards rationale", "implementation guidance"]
        },
        {
            "id": "privacy_rule_2000",
            "title": "Privacy Rule Final Rule (2000)",
            "url": "https://www.govinfo.gov/content/pkg/FR-2000-12-28/pdf/00-32678.pdf",
            "filename": "privacy_rule_2000.pdf",
            "source": "govinfo.gov",
            "document_type": "preamble",
            "estimated_pages": 183,
            "topics": ["Privacy standards", "uses and disclosures", "individual rights"]
        },
        {
            "id": "privacy_mod_2002",
            "title": "Privacy Rule Modifications (2002)",
            "url": "https://www.govinfo.gov/content/pkg/FR-2002-08-14/pdf/02-20554.pdf",
            "filename": "privacy_mod_2002.pdf",
            "source": "govinfo.gov",
            "document_type": "preamble",
            "estimated_pages": 78,
            "topics": ["Clarifications", "corrections", "refinements"]
        },
        {
            "id": "hitech_omnibus_2013",
            "title": "HITECH Omnibus Final Rule (2013)",
            "url": "https://www.govinfo.gov/content/pkg/FR-2013-01-25/pdf/2013-01073.pdf",
            "filename": "hitech_omnibus_2013.pdf",
            "source": "govinfo.gov",
            "document_type": "preamble",
            "estimated_pages": 127,
            "topics": ["HITECH Act modifications", "breach notification updates", "business associate requirements"]
        },
        {
            "id": "breach_notification_2009",
            "title": "Breach Notification Rule (2009)",
            "url": "https://www.govinfo.gov/content/pkg/FR-2009-08-24/pdf/E9-20169.pdf",
            "filename": "breach_notification_2009.pdf",
            "source": "govinfo.gov",
            "document_type": "preamble",
            "estimated_pages": 62,
            "topics": ["Breach definition", "notification requirements", "risk assessment"]
        },

        # NIST Publications
        {
            "id": "nist_sp800_66r2",
            "title": "NIST SP 800-66 Rev. 2: Implementing the HIPAA Security Rule",
            "url": "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-66r2.pdf",
            "filename": "nist_sp800-66r2.pdf",
            "source": "nist.gov",
            "document_type": "guidance",
            "estimated_pages": 120,
            "topics": ["Security Rule implementation", "safeguards", "risk analysis"]
        },

        # FDA Guidance Documents
        {
            "id": "fda_premarket_2023",
            "title": "FDA Cybersecurity in Medical Devices: Quality System Considerations (2023)",
            "url": "https://www.fda.gov/media/119933/download",
            "filename": "fda_premarket_2023.pdf",
            "source": "fda.gov",
            "document_type": "guidance",
            "estimated_pages": 35,
            "topics": ["Device security", "cybersecurity controls", "premarket submissions"]
        },
        {
            "id": "fda_postmarket_2016",
            "title": "FDA Postmarket Management of Cybersecurity in Medical Devices (2016)",
            "url": "https://www.fda.gov/media/95862/download",
            "filename": "fda_postmarket_2016.pdf",
            "source": "fda.gov",
            "document_type": "guidance",
            "estimated_pages": 30,
            "topics": ["Vulnerability management", "patching", "incident response"]
        },
        {
            "id": "fda_premarket_draft_2022",
            "title": "FDA Content of Premarket Submissions - Draft Guidance (2022)",
            "url": "https://www.fda.gov/media/156299/download",
            "filename": "fda_premarket_draft_2022.pdf",
            "source": "fda.gov",
            "document_type": "guidance",
            "estimated_pages": 30,
            "topics": ["Premarket security documentation", "SBOM", "vulnerability disclosure"]
        }
    ]

    def __init__(self, output_dir: str = "data/hipaa/raw"):
        """
        Initialize downloader.

        Args:
            output_dir: Directory to save downloaded documents
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })

        self.metadata = {
            "download_date": datetime.now().isoformat(),
            "total_documents": len(self.DOCUMENTS),
            "estimated_total_pages": sum(doc["estimated_pages"] for doc in self.DOCUMENTS),
            "documents": []
        }

    def download_document(self, doc: Dict) -> bool:
        """
        Download a single document.

        Args:
            doc: Document metadata dictionary

        Returns:
            True if successful, False otherwise
        """
        output_path = self.output_dir / doc["filename"]

        # Skip if already exists
        if output_path.exists():
            logger.info(f"✓ {doc['filename']} already exists, skipping...")
            file_size = output_path.stat().st_size
            self.metadata["documents"].append({
                **doc,
                "downloaded": True,
                "file_size_bytes": file_size,
                "file_path": str(output_path)
            })
            return True

        logger.info(f"Downloading {doc['title']}...")
        logger.info(f"  URL: {doc['url']}")

        try:
            # Download with timeout
            response = self.session.get(doc["url"], timeout=60, stream=True)
            response.raise_for_status()

            # Save to file
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            file_size = output_path.stat().st_size
            logger.info(f"  ✓ Downloaded {file_size / 1024 / 1024:.1f} MB")

            # Update metadata
            self.metadata["documents"].append({
                **doc,
                "downloaded": True,
                "file_size_bytes": file_size,
                "file_path": str(output_path)
            })

            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"  ✗ Download failed: {e}")
            self.metadata["documents"].append({
                **doc,
                "downloaded": False,
                "error": str(e)
            })
            return False

    def download_all(self, delay: float = 2.0) -> Dict:
        """
        Download all documents.

        Args:
            delay: Delay between downloads in seconds (be polite to servers)

        Returns:
            Metadata dictionary with download results
        """
        logger.info(f"\n{'='*60}")
        logger.info(f"HIPAA DOCUMENT DOWNLOADER")
        logger.info(f"{'='*60}")
        logger.info(f"Total documents: {len(self.DOCUMENTS)}")
        logger.info(f"Estimated pages: {sum(doc['estimated_pages'] for doc in self.DOCUMENTS)}")
        logger.info(f"Output directory: {self.output_dir}")
        logger.info(f"{'='*60}\n")

        successful = 0
        failed = 0

        for i, doc in enumerate(self.DOCUMENTS, 1):
            logger.info(f"[{i}/{len(self.DOCUMENTS)}] {doc['id']}")

            if self.download_document(doc):
                successful += 1
            else:
                failed += 1

            # Be polite - delay between downloads
            if i < len(self.DOCUMENTS):
                time.sleep(delay)

        # Update summary
        self.metadata.update({
            "successful_downloads": successful,
            "failed_downloads": failed,
            "success_rate": f"{successful / len(self.DOCUMENTS) * 100:.1f}%"
        })

        # Save metadata
        metadata_path = self.output_dir / "hipaa_metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(self.metadata, f, indent=2)

        logger.info(f"\n{'='*60}")
        logger.info(f"DOWNLOAD SUMMARY")
        logger.info(f"{'='*60}")
        logger.info(f"Successful: {successful}/{len(self.DOCUMENTS)}")
        logger.info(f"Failed: {failed}/{len(self.DOCUMENTS)}")
        logger.info(f"Success rate: {self.metadata['success_rate']}")
        logger.info(f"\nMetadata saved: {metadata_path}")
        logger.info(f"{'='*60}\n")

        return self.metadata

    def print_inventory(self):
        """Print document inventory."""
        logger.info(f"\n{'='*60}")
        logger.info(f"HIPAA DOCUMENT INVENTORY")
        logger.info(f"{'='*60}\n")

        # Group by type
        by_type = {}
        for doc in self.DOCUMENTS:
            doc_type = doc["document_type"]
            if doc_type not in by_type:
                by_type[doc_type] = []
            by_type[doc_type].append(doc)

        for doc_type, docs in by_type.items():
            total_pages = sum(d["estimated_pages"] for d in docs)
            logger.info(f"{doc_type.upper()} ({len(docs)} documents, ~{total_pages} pages):")
            for doc in docs:
                logger.info(f"  • {doc['title']} (~{doc['estimated_pages']} pages)")
            logger.info("")

        logger.info(f"TOTAL: {len(self.DOCUMENTS)} documents, ~{sum(doc['estimated_pages'] for doc in self.DOCUMENTS)} pages")
        logger.info(f"{'='*60}\n")


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Download HIPAA compliance documents from federal sources",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Download all documents to default directory
  python scripts/download_hipaa_docs.py

  # Download to custom directory
  python scripts/download_hipaa_docs.py --output data/hipaa/raw

  # Print inventory without downloading
  python scripts/download_hipaa_docs.py --inventory-only

  # Adjust delay between downloads
  python scripts/download_hipaa_docs.py --delay 3.0
"""
    )

    parser.add_argument(
        "--output",
        type=str,
        default="data/hipaa/raw",
        help="Output directory for downloaded documents (default: data/hipaa/raw)"
    )

    parser.add_argument(
        "--delay",
        type=float,
        default=2.0,
        help="Delay between downloads in seconds (default: 2.0)"
    )

    parser.add_argument(
        "--inventory-only",
        action="store_true",
        help="Print document inventory without downloading"
    )

    args = parser.parse_args()

    downloader = HIPAADocumentDownloader(output_dir=args.output)

    if args.inventory_only:
        downloader.print_inventory()
        return

    # Download all documents
    metadata = downloader.download_all(delay=args.delay)

    # Check for failures
    if metadata["failed_downloads"] > 0:
        logger.warning(f"\n⚠️  {metadata['failed_downloads']} documents failed to download")
        logger.warning("Check the metadata file for details")
        sys.exit(1)
    else:
        logger.info("✅ All documents downloaded successfully!")
        logger.info(f"\nNext steps:")
        logger.info(f"1. Extract documents:")
        logger.info(f"   python src/extract_with_fallback.py --input {args.output} --output data/hipaa/extracted")
        logger.info(f"2. Prepare training data:")
        logger.info(f"   python src/prepare_hipaa_data.py --input data/hipaa/extracted --output data/hipaa/training")


if __name__ == "__main__":
    main()
