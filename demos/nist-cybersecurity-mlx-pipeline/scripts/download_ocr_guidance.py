#!/usr/bin/env python3
"""
Download HHS OCR HIPAA Guidance Documents.

Extracts Q&A and guidance from HHS Office for Civil Rights publications.
These PDFs contain practical HIPAA implementation guidance and FAQs.
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


class OCRGuidanceDownloader:
    """Download HHS OCR HIPAA guidance documents."""

    # Comprehensive list of HHS OCR guidance PDFs
    GUIDANCE_DOCS = [
        # Privacy Rule Guidance
        {
            "id": "privacy_rule_summary",
            "title": "Summary of the HIPAA Privacy Rule",
            "url": "https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/understanding/summary/privacysummary.pdf",
            "filename": "privacy_rule_summary.pdf",
            "category": "privacy",
            "topics": ["privacy rule", "uses and disclosures", "individual rights", "minimum necessary"]
        },
        {
            "id": "privacy_rule_full",
            "title": "HIPAA Privacy Rule (Full Regulation)",
            "url": "https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/administrative/privacyrule/privrulepd.pdf",
            "filename": "privacy_rule_full.pdf",
            "category": "privacy",
            "topics": ["privacy standards", "protected health information", "covered entities"]
        },
        {
            "id": "right_of_access",
            "title": "HIPAA Right of Access and Health IT",
            "url": "https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/understanding/special/healthit/eaccess.pdf",
            "filename": "right_of_access_healthit.pdf",
            "category": "privacy",
            "topics": ["right of access", "health IT", "electronic health records", "patient access"]
        },
        {
            "id": "sharing_tpo",
            "title": "FAQs on Treatment, Payment, and Health Care Operations",
            "url": "https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/understanding/coveredentities/sharingfortpo.pdf",
            "filename": "faqs_treatment_payment_operations.pdf",
            "category": "privacy",
            "topics": ["treatment", "payment", "health care operations", "TPO"]
        },
        {
            "id": "correction_guidance",
            "title": "HIPAA Privacy Rule and Corrections in Networked Environment",
            "url": "https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/understanding/special/healthit/correction.pdf",
            "filename": "corrections_networked_environment.pdf",
            "category": "privacy",
            "topics": ["corrections", "amendments", "networked environment", "health IT"]
        },
        {
            "id": "model_notices",
            "title": "Model Notices of Privacy Practices Q&A",
            "url": "https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/q_and_i-use_of_model_notices.pdf",
            "filename": "model_notices_qa.pdf",
            "category": "privacy",
            "topics": ["notice of privacy practices", "NPP", "model notices"]
        },
        {
            "id": "media_access",
            "title": "Guidance on Media and Film Crews Access to PHI",
            "url": "https://www.hhs.gov/sites/default/files/guidance-on-media-and-film-crews-access-to-phi.pdf",
            "filename": "media_film_crews_phi.pdf",
            "category": "privacy",
            "topics": ["media access", "film crews", "PHI disclosure", "authorization"]
        },

        # Breach Notification Guidance
        {
            "id": "breach_portal_info",
            "title": "Breach Portal Required Information",
            "url": "https://ocrportal.hhs.gov/ocr/breach/doc/Breach_Portal_Questions_508.pdf",
            "filename": "breach_portal_questions.pdf",
            "category": "breach",
            "topics": ["breach notification", "breach portal", "reporting requirements"]
        },
        {
            "id": "telehealth_covid_faqs",
            "title": "Telehealth and HIPAA FAQs during COVID-19",
            "url": "https://www.hhs.gov/sites/default/files/telehealth-faqs-508.pdf",
            "filename": "telehealth_covid_faqs.pdf",
            "category": "privacy",
            "topics": ["telehealth", "COVID-19", "enforcement discretion", "remote communications"]
        },

        # Compliance and Enforcement
        {
            "id": "cms_compliance_review",
            "title": "HIPAA Compliance Review Analysis and Summary",
            "url": "https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/enforcement/cmscompliancerev08.pdf",
            "filename": "cms_compliance_review.pdf",
            "category": "enforcement",
            "topics": ["compliance review", "CMS", "enforcement", "audit findings"]
        },

        # Additional Security and Privacy Guidance
        {
            "id": "security_rule_guidance",
            "title": "HIPAA Security Rule Guidance Material",
            "url": "https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/administrative/securityrule/securityruleguidance.pdf",
            "filename": "security_rule_guidance.pdf",
            "category": "security",
            "topics": ["security rule", "safeguards", "risk analysis", "implementation"]
        },
        {
            "id": "risk_analysis",
            "title": "HIPAA Security Rule Risk Analysis Guidance",
            "url": "https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/administrative/securityrule/rafinalguidancepdf.pdf",
            "filename": "risk_analysis_guidance.pdf",
            "category": "security",
            "topics": ["risk analysis", "risk assessment", "security rule", "ePHI"]
        },
        {
            "id": "business_associate_contracts",
            "title": "Business Associate Contracts Sample Provisions",
            "url": "https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/understanding/coveredentities/contractprov.pdf",
            "filename": "business_associate_contracts.pdf",
            "category": "privacy",
            "topics": ["business associates", "BAA", "contracts", "sample provisions"]
        },
        {
            "id": "minimum_necessary",
            "title": "Minimum Necessary Requirement Guidance",
            "url": "https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/understanding/coveredentities/minimumnecessary.pdf",
            "filename": "minimum_necessary_guidance.pdf",
            "category": "privacy",
            "topics": ["minimum necessary", "uses and disclosures", "privacy rule"]
        },
        {
            "id": "authorization_guidance",
            "title": "HIPAA Authorization for Uses and Disclosures",
            "url": "https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/understanding/coveredentities/authorization.pdf",
            "filename": "authorization_guidance.pdf",
            "category": "privacy",
            "topics": ["authorization", "uses and disclosures", "individual rights"]
        },

        # Cloud and Health IT Guidance
        {
            "id": "cloud_computing",
            "title": "HIPAA and Cloud Computing Guidance",
            "url": "https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/understanding/special/healthit/cloudguidance.pdf",
            "filename": "cloud_computing_guidance.pdf",
            "category": "security",
            "topics": ["cloud computing", "health IT", "business associates", "security"]
        },
        {
            "id": "mobile_devices",
            "title": "HIPAA and Mobile Device Guidance",
            "url": "https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/understanding/special/healthit/mobiledeviceprivacy.pdf",
            "filename": "mobile_device_guidance.pdf",
            "category": "security",
            "topics": ["mobile devices", "smartphones", "tablets", "ePHI", "security"]
        },
        {
            "id": "personal_devices_byod",
            "title": "Personal Devices and HIPAA (BYOD)",
            "url": "https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/understanding/special/healthit/personaldevices.pdf",
            "filename": "personal_devices_byod.pdf",
            "category": "security",
            "topics": ["BYOD", "bring your own device", "personal devices", "security"]
        },

        # Research and Public Health
        {
            "id": "research_guidance",
            "title": "HIPAA Privacy Rule and Research",
            "url": "https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/understanding/special/research/research.pdf",
            "filename": "research_guidance.pdf",
            "category": "privacy",
            "topics": ["research", "IRB", "authorization", "de-identification"]
        },
        {
            "id": "public_health",
            "title": "HIPAA Privacy Rule and Public Health",
            "url": "https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/understanding/special/publichealth/publichealth.pdf",
            "filename": "public_health_guidance.pdf",
            "category": "privacy",
            "topics": ["public health", "disclosures", "disease surveillance"]
        },

        # De-identification
        {
            "id": "deidentification",
            "title": "HIPAA De-identification Guidance",
            "url": "https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/understanding/coveredentities/de-identification.pdf",
            "filename": "deidentification_guidance.pdf",
            "category": "privacy",
            "topics": ["de-identification", "safe harbor", "expert determination", "limited data sets"]
        },

        # Marketing and Fundraising
        {
            "id": "marketing",
            "title": "HIPAA Marketing Guidance",
            "url": "https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/understanding/coveredentities/marketing.pdf",
            "filename": "marketing_guidance.pdf",
            "category": "privacy",
            "topics": ["marketing", "authorization", "treatment communications"]
        }
    ]

    def __init__(self, output_dir: str = "data/hipaa/raw/ocr_guidance"):
        """Initialize downloader."""
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Educational Research - HIPAA Compliance Dataset)'
        })

        self.metadata = {
            "source": "HHS Office for Civil Rights",
            "download_date": None,
            "total_documents": len(self.GUIDANCE_DOCS),
            "documents": []
        }

    def download_pdf(self, doc: Dict) -> bool:
        """Download a single guidance PDF."""
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
            response = self.session.get(doc["url"], timeout=30)
            response.raise_for_status()

            # Verify it's a PDF
            content_type = response.headers.get('Content-Type', '')
            if 'pdf' not in content_type.lower() and not doc['url'].endswith('.pdf'):
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
        """Download all guidance documents."""
        from datetime import datetime
        self.metadata["download_date"] = datetime.now().isoformat()

        logger.info(f"\n{'='*60}")
        logger.info(f"HHS OCR GUIDANCE DOWNLOADER")
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
        metadata_path = self.output_dir / "ocr_guidance_metadata.json"
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
            logger.info("✅ All OCR guidance documents downloaded successfully!")
            logger.info("\nNext steps:")
            logger.info("1. Extract PDFs to markdown with Docling")
            logger.info("2. Integrate into prepare_hipaa_data.py")
            logger.info("3. Re-run training data generation")
        else:
            logger.warning(f"⚠️  {failed} documents failed to download")

        return successful, failed


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Download HHS OCR HIPAA guidance documents",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Download all guidance PDFs
  python scripts/download_ocr_guidance.py

  # Download to custom directory
  python scripts/download_ocr_guidance.py --output data/hipaa/raw/ocr_guidance

  # Adjust delay between downloads
  python scripts/download_ocr_guidance.py --delay 3.0
"""
    )

    parser.add_argument(
        "--output",
        type=str,
        default="data/hipaa/raw/ocr_guidance",
        help="Output directory (default: data/hipaa/raw/ocr_guidance)"
    )

    parser.add_argument(
        "--delay",
        type=float,
        default=2.0,
        help="Delay between downloads in seconds (default: 2.0)"
    )

    args = parser.parse_args()

    downloader = OCRGuidanceDownloader(output_dir=args.output)
    successful, failed = downloader.download_all(delay=args.delay)

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
