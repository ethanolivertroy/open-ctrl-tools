#!/usr/bin/env python3
"""
Download FDA Medical Device Cybersecurity Guidance.

Expands FDA coverage beyond the 2 documents in v1.0.
Includes latest cybersecurity guidance, SBOM, postmarket management, and FAQs.
"""

import os
import sys
import json
import time
import requests
from pathlib import Path
from typing import Dict, List
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


class FDAGuidanceDownloader:
    """Download FDA medical device cybersecurity guidance documents."""

    # FDA guidance documents (expanded collection)
    GUIDANCE_DOCS = [
        # Core Cybersecurity Guidance
        {
            "id": "cybersecurity_premarket_2023",
            "title": "Cybersecurity in Medical Devices: Quality System and Premarket Submissions (2023)",
            "url": "https://www.fda.gov/media/119933/download",
            "filename": "cybersecurity_premarket_2023.pdf",
            "category": "premarket",
            "topics": ["cybersecurity", "quality system", "premarket submissions", "SBOM"]
        },
        {
            "id": "cybersecurity_premarket_slides",
            "title": "Cybersecurity in Medical Devices Final Guidance Presentation (2023)",
            "url": "https://www.fda.gov/media/173516/download",
            "filename": "cybersecurity_premarket_presentation_2023.pdf",
            "category": "premarket",
            "topics": ["cybersecurity", "slides", "presentation", "overview"]
        },
        {
            "id": "postmarket_cybersecurity_2016",
            "title": "Postmarket Management of Cybersecurity in Medical Devices (2016)",
            "url": "https://www.fda.gov/files/medical%20devices/published/Postmarket-Management-of-Cybersecurity-in-Medical-Devices---Guidance-for-Industry-and-Food-and-Drug-Administration-Staff.pdf",
            "filename": "postmarket_cybersecurity_2016.pdf",
            "category": "postmarket",
            "topics": ["postmarket", "vulnerability management", "patches", "updates"]
        },
        {
            "id": "fda_cybersecurity_factsheet",
            "title": "FDA's Role in Medical Device Cybersecurity - Fact Sheet",
            "url": "https://www.fda.gov/media/103696/download",
            "filename": "fda_cybersecurity_factsheet.pdf",
            "category": "overview",
            "topics": ["FDA role", "cybersecurity", "overview", "fact sheet"]
        },

        # Software as a Medical Device (SaMD)
        {
            "id": "samd_clinical_evaluation",
            "title": "Software as a Medical Device: Clinical Evaluation",
            "url": "https://www.fda.gov/media/100714/download",
            "filename": "samd_clinical_evaluation.pdf",
            "category": "samd",
            "topics": ["SaMD", "clinical evaluation", "software", "medical device"]
        },
        {
            "id": "samd_key_definitions",
            "title": "Software as a Medical Device: Key Definitions",
            "url": "https://www.fda.gov/media/99887/download",
            "filename": "samd_key_definitions.pdf",
            "category": "samd",
            "topics": ["SaMD", "definitions", "framework", "IMDRF"]
        },

        # Digital Health and Software Validation
        {
            "id": "mobile_medical_apps",
            "title": "Policy for Device Software Functions and Mobile Medical Applications",
            "url": "https://www.fda.gov/media/80958/download",
            "filename": "mobile_medical_apps_policy.pdf",
            "category": "software",
            "topics": ["mobile apps", "software functions", "policy", "enforcement"]
        },
        {
            "id": "software_validation",
            "title": "General Principles of Software Validation",
            "url": "https://www.fda.gov/media/73141/download",
            "filename": "software_validation_principles.pdf",
            "category": "software",
            "topics": ["software validation", "V&V", "testing", "quality"]
        },
        {
            "id": "off_shelf_software",
            "title": "Off-The-Shelf Software Use in Medical Devices",
            "url": "https://www.fda.gov/media/71794/download",
            "filename": "off_shelf_software.pdf",
            "category": "software",
            "topics": ["OTS software", "COTS", "off-the-shelf", "validation"]
        },

        # Wireless and Network Security
        {
            "id": "wireless_medical_devices",
            "title": "Radio Frequency Wireless Technology in Medical Devices",
            "url": "https://www.fda.gov/media/71975/download",
            "filename": "wireless_medical_devices.pdf",
            "category": "wireless",
            "topics": ["wireless", "RF", "radio frequency", "communication"]
        },
        {
            "id": "cybersecurity_legacy_devices",
            "title": "Cybersecurity for Networked Medical Devices with OTS Software",
            "url": "https://www.fda.gov/media/70762/download",
            "filename": "cybersecurity_legacy_ots.pdf",
            "category": "cybersecurity",
            "topics": ["legacy devices", "OTS software", "networked devices", "cybersecurity"]
        },

        # FDA Technical Documents
        {
            "id": "interoperability",
            "title": "Design Considerations for Medical Device Interoperability",
            "url": "https://www.fda.gov/media/95636/download",
            "filename": "medical_device_interoperability.pdf",
            "category": "technical",
            "topics": ["interoperability", "integration", "health IT", "design"]
        },
        {
            "id": "clinical_decision_support",
            "title": "Clinical Decision Support Software Guidance",
            "url": "https://www.fda.gov/media/109618/download",
            "filename": "clinical_decision_support.pdf",
            "category": "software",
            "topics": ["CDS", "clinical decision support", "AI", "ML"]
        },
        {
            "id": "artificial_intelligence_ml",
            "title": "Marketing Submission for AI/ML-Based SaMD",
            "url": "https://www.fda.gov/media/122535/download",
            "filename": "ai_ml_samd_marketing.pdf",
            "category": "ai_ml",
            "topics": ["artificial intelligence", "machine learning", "AI/ML", "SaMD"]
        },

        # Quality System Regulation
        {
            "id": "qsr_medical_devices",
            "title": "Quality System Regulation (21 CFR Part 820)",
            "url": "https://www.fda.gov/media/116853/download",
            "filename": "quality_system_regulation_820.pdf",
            "category": "quality",
            "topics": ["QSR", "21 CFR 820", "quality system", "manufacturing"]
        }
    ]

    def __init__(self, output_dir: str = "data/hipaa/raw/fda_guidance"):
        """Initialize downloader."""
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Educational Research - Medical Device Cybersecurity Dataset)'
        })

        self.metadata = {
            "source": "U.S. Food and Drug Administration",
            "download_date": None,
            "total_documents": len(self.GUIDANCE_DOCS),
            "documents": []
        }

    def download_pdf(self, doc: Dict) -> bool:
        """Download a single FDA guidance PDF."""
        output_path = self.output_dir / doc["filename"]

        # Skip if already exists and valid
        if output_path.exists() and output_path.stat().st_size > 10000:  # > 10KB
            logger.info(f"✓ {doc['filename']} already exists ({output_path.stat().st_size / 1024:.1f} KB)")

            self.metadata["documents"].append({
                **doc,
                "downloaded": True,
                "file_size_bytes": output_path.stat().st_size,
                "file_path": str(output_path)
            })
            return True

        logger.info(f"Downloading {doc['title']}...")
        logger.info(f"  URL: {doc['url']}")

        try:
            response = self.session.get(doc["url"], timeout=30, allow_redirects=True)
            response.raise_for_status()

            # Verify it's a PDF
            content_type = response.headers.get('Content-Type', '')
            if 'pdf' not in content_type.lower():
                logger.warning(f"  ⚠️  Content-Type is '{content_type}', may not be PDF")

            # Save PDF
            with open(output_path, 'wb') as f:
                f.write(response.content)

            file_size = output_path.stat().st_size
            logger.info(f"  ✓ Downloaded {file_size / 1024:.1f} KB")

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

    def download_all(self, delay: float = 2.0):
        """Download all FDA guidance documents."""
        from datetime import datetime
        self.metadata["download_date"] = datetime.now().isoformat()

        logger.info(f"\n{'='*60}")
        logger.info(f"FDA MEDICAL DEVICE GUIDANCE DOWNLOADER")
        logger.info(f"{'='*60}")
        logger.info(f"Documents to download: {len(self.GUIDANCE_DOCS)}")
        logger.info(f"Output directory: {self.output_dir}")
        logger.info(f"{'='*60}\n")

        successful = 0
        failed = 0

        for i, doc in enumerate(self.GUIDANCE_DOCS, 1):
            logger.info(f"[{i}/{len(self.GUIDANCE_DOCS)}] {doc['id']}")

            if self.download_pdf(doc):
                successful += 1
            else:
                failed += 1

            # Be polite - delay between downloads
            if i < len(self.GUIDANCE_DOCS):
                time.sleep(delay)

        # Save metadata
        metadata_path = self.output_dir / "fda_guidance_metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(self.metadata, f, indent=2)

        logger.info(f"\n{'='*60}")
        logger.info(f"DOWNLOAD SUMMARY")
        logger.info(f"{'='*60}")
        logger.info(f"Successful: {successful}/{len(self.GUIDANCE_DOCS)}")
        logger.info(f"Failed: {failed}/{len(self.GUIDANCE_DOCS)}")

        # Category breakdown
        by_category = {}
        for doc_meta in self.metadata["documents"]:
            if doc_meta.get("downloaded"):
                cat = doc_meta["category"]
                by_category[cat] = by_category.get(cat, 0) + 1

        logger.info(f"\nBy Category:")
        for cat, count in sorted(by_category.items()):
            logger.info(f"  {cat}: {count}")

        logger.info(f"\nMetadata saved: {metadata_path}")
        logger.info(f"{'='*60}\n")

        if failed == 0:
            logger.info("✅ All FDA guidance documents downloaded successfully!")
            logger.info("\nNext steps:")
            logger.info("1. Extract PDFs to markdown with Docling")
            logger.info("2. Integrate into prepare_hipaa_data.py")
            logger.info("3. Re-run training data generation for HIPAA v1.1")
        else:
            logger.warning(f"⚠️  {failed} documents failed to download")

        return successful, failed


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Download FDA medical device cybersecurity guidance",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Download all FDA guidance
  python scripts/download_fda_guidance.py

  # Download to custom directory
  python scripts/download_fda_guidance.py --output data/hipaa/raw/fda_guidance

  # Adjust delay
  python scripts/download_fda_guidance.py --delay 3.0
"""
    )

    parser.add_argument(
        "--output",
        type=str,
        default="data/hipaa/raw/fda_guidance",
        help="Output directory (default: data/hipaa/raw/fda_guidance)"
    )

    parser.add_argument(
        "--delay",
        type=float,
        default=2.0,
        help="Delay between downloads in seconds (default: 2.0)"
    )

    args = parser.parse_args()

    downloader = FDAGuidanceDownloader(output_dir=args.output)
    successful, failed = downloader.download_all(delay=args.delay)

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
