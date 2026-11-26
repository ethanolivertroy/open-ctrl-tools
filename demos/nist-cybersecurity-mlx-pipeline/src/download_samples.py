#!/usr/bin/env python3
"""
Simple NIST Document Downloader

Downloads specific NIST documents directly using their known URLs.
"""

import os
import requests
from pathlib import Path
import json
import time
from tqdm import tqdm
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Well-known NIST cybersecurity documents
NIST_DOCUMENTS = [
    {
        "title": "NIST SP 800-207 - Zero Trust Architecture",
        "url": "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-207.pdf",
        "filename": "NIST_SP_800-207_Zero_Trust_Architecture.pdf"
    },
    {
        "title": "NIST SP 800-53 Rev 5 - Security and Privacy Controls",
        "url": "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-53r5.pdf",
        "filename": "NIST_SP_800-53r5_Security_Privacy_Controls.pdf"
    },
    {
        "title": "NIST SP 800-37 Rev 2 - Risk Management Framework",
        "url": "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-37r2.pdf",
        "filename": "NIST_SP_800-37r2_Risk_Management_Framework.pdf"
    },
    {
        "title": "NIST SP 800-171 Rev 2 - Protecting Controlled Unclassified Information",
        "url": "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-171r2.pdf",
        "filename": "NIST_SP_800-171r2_Protecting_CUI.pdf"
    },
    {
        "title": "NIST SP 800-61 Rev 2 - Incident Handling Guide",
        "url": "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-61r2.pdf",
        "filename": "NIST_SP_800-61r2_Incident_Handling.pdf"
    },
    {
        "title": "NIST Cybersecurity Framework v2.0",
        "url": "https://nvlpubs.nist.gov/nistpubs/CSWP/NIST.CSWP.31.pdf",
        "filename": "NIST_CSF_v2.0.pdf"
    },
    {
        "title": "NIST SP 800-63-3 - Digital Identity Guidelines",
        "url": "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-63-3.pdf",
        "filename": "NIST_SP_800-63-3_Digital_Identity.pdf"
    },
    {
        "title": "NIST SP 800-30 Rev 1 - Risk Assessment",
        "url": "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-30r1.pdf",
        "filename": "NIST_SP_800-30r1_Risk_Assessment.pdf"
    },
]


def download_document(doc, output_dir, session):
    """Download a single document."""
    output_path = output_dir / doc['filename']

    if output_path.exists():
        logger.info(f"Already exists: {doc['filename']}")
        return True

    try:
        logger.info(f"Downloading: {doc['title']}")
        response = session.get(doc['url'], timeout=60, stream=True)
        response.raise_for_status()

        total_size = int(response.headers.get('content-length', 0))

        with open(output_path, 'wb') as f:
            if total_size == 0:
                f.write(response.content)
            else:
                downloaded = 0
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)

        logger.info(f"✓ Downloaded: {doc['filename']}")
        return True

    except Exception as e:
        logger.error(f"Failed to download {doc['title']}: {e}")
        if output_path.exists():
            output_path.unlink()
        return False


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Download NIST documents')
    parser.add_argument('--output', '-o', default='data/raw',
                        help='Output directory')
    parser.add_argument('--max', type=int, default=None,
                        help='Maximum number of documents to download')

    args = parser.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    })

    docs_to_download = NIST_DOCUMENTS[:args.max] if args.max else NIST_DOCUMENTS

    logger.info(f"Downloading {len(docs_to_download)} NIST documents...")

    results = []
    for doc in tqdm(docs_to_download, desc="Downloading"):
        success = download_document(doc, output_dir, session)
        results.append({
            'title': doc['title'],
            'filename': doc['filename'],
            'downloaded': success
        })
        time.sleep(1)  # Be respectful

    # Save metadata
    metadata_path = output_dir / 'metadata.json'
    with open(metadata_path, 'w') as f:
        json.dump(results, f, indent=2)

    successful = sum(1 for r in results if r['downloaded'])
    logger.info(f"\n✓ Successfully downloaded {successful}/{len(results)} documents")
    logger.info(f"Metadata saved to: {metadata_path}")

    # List downloaded files
    logger.info(f"\nDownloaded files:")
    for pdf in sorted(output_dir.glob('*.pdf')):
        size_mb = pdf.stat().st_size / (1024 * 1024)
        logger.info(f"  - {pdf.name} ({size_mb:.1f} MB)")


if __name__ == '__main__':
    main()
