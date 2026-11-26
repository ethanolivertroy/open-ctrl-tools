#!/usr/bin/env python3
"""
Comprehensive NIST Document Downloader

Downloads all FIPS, SP, and IR documents from NIST CSRC search results.
"""

import os
import requests
from pathlib import Path
import json
import time
from tqdm import tqdm
import logging
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class NISTDownloader:
    """Download all NIST publications from CSRC."""

    BASE_URL = "https://csrc.nist.gov"
    SEARCH_URL = "https://csrc.nist.gov/publications/search"

    def __init__(self, output_dir: str, delay: float = 1.0):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.delay = delay
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })

    def get_search_results_page(self):
        """Get the main search results page with all publications."""
        params = {
            'sortBy-lg': 'releasedate DESC',
            'viewMode-lg': 'brief',
            'ipp-lg': 'all',  # Get all items
            'status-lg': 'Final',
            'series-lg': 'FIPS,SP,IR,CSWP',
            'topicsMatch-lg': 'ANY',
            'controlsMatch-lg': 'ANY'
        }

        logger.info("Fetching NIST publications list...")
        try:
            response = self.session.get(self.SEARCH_URL, params=params, timeout=60)
            response.raise_for_status()
            return response.text
        except Exception as e:
            logger.error(f"Failed to fetch search results: {e}")
            return None

    def extract_publication_links(self, html):
        """Extract all publication links from search results."""
        soup = BeautifulSoup(html, 'html.parser')
        publications = []

        # Find all publication entries - try multiple selectors
        entries = (
            soup.find_all('div', class_='publication-item') or
            soup.find_all('article', class_='publication') or
            soup.find_all('div', class_='result-item') or
            soup.find_all('li', class_='search-result')
        )

        logger.info(f"Found {len(entries)} publication entries")

        if not entries:
            # Try finding all links to publication details
            all_links = soup.find_all('a', href=True)
            logger.info(f"Trying alternative method - found {len(all_links)} links")

            for link in all_links:
                href = link['href']
                # Look for publication detail pages
                if '/pubs/' in href or '/publications/detail' in href:
                    full_url = urljoin(self.BASE_URL, href)
                    title = link.get_text(strip=True)
                    if title and len(title) > 5:  # Avoid empty or very short titles
                        publications.append({
                            'title': title,
                            'detail_url': full_url
                        })

        else:
            for entry in entries:
                try:
                    # Find title and link
                    title_elem = (
                        entry.find('h3') or
                        entry.find('h2') or
                        entry.find('a', class_='title') or
                        entry.find('a')
                    )

                    if title_elem:
                        title = title_elem.get_text(strip=True)
                        link = title_elem.get('href') or title_elem.find('a', href=True)

                        if link:
                            if isinstance(link, str):
                                detail_url = urljoin(self.BASE_URL, link)
                            else:
                                detail_url = urljoin(self.BASE_URL, link['href'])

                            publications.append({
                                'title': title,
                                'detail_url': detail_url
                            })
                except Exception as e:
                    logger.debug(f"Error parsing entry: {e}")
                    continue

        # Remove duplicates based on URL
        seen = set()
        unique_pubs = []
        for pub in publications:
            if pub['detail_url'] not in seen:
                seen.add(pub['detail_url'])
                unique_pubs.append(pub)

        logger.info(f"Found {len(unique_pubs)} unique publications")
        return unique_pubs

    def get_pdf_url(self, detail_url):
        """Get PDF download URL from publication detail page."""
        try:
            response = self.session.get(detail_url, timeout=30)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')

            # Look for PDF download link
            pdf_link = None

            # Method 1: Direct PDF links
            for link in soup.find_all('a', href=True):
                href = link['href']
                if href.endswith('.pdf'):
                    pdf_link = urljoin(self.BASE_URL, href)
                    break
                # Check for download buttons/links
                if 'download' in link.get_text().lower() and '.pdf' in href:
                    pdf_link = urljoin(self.BASE_URL, href)
                    break

            # Method 2: Look in specific download sections
            if not pdf_link:
                download_section = soup.find('div', class_='publication-download') or soup.find('div', id='download')
                if download_section:
                    link = download_section.find('a', href=lambda x: x and '.pdf' in x)
                    if link:
                        pdf_link = urljoin(self.BASE_URL, link['href'])

            # Method 3: nvlpubs.nist.gov pattern
            if not pdf_link:
                # Extract document ID from URL and construct nvlpubs URL
                doc_id = self._extract_doc_id(detail_url)
                if doc_id:
                    # Try common patterns
                    patterns = [
                        f"https://nvlpubs.nist.gov/nistpubs/SpecialPublications/{doc_id}.pdf",
                        f"https://nvlpubs.nist.gov/nistpubs/FIPS/{doc_id}.pdf",
                        f"https://nvlpubs.nist.gov/nistpubs/ir/{doc_id}.pdf",
                    ]
                    for pattern in patterns:
                        try:
                            head = self.session.head(pattern, timeout=10)
                            if head.status_code == 200:
                                pdf_link = pattern
                                break
                        except:
                            continue

            return pdf_link

        except Exception as e:
            logger.debug(f"Error getting PDF URL from {detail_url}: {e}")
            return None

    def _extract_doc_id(self, url):
        """Extract document ID from URL."""
        # Try to extract patterns like SP.800-207, FIPS.140-2, etc.
        patterns = [
            r'(NIST\.[A-Z]+\.\d+[-\.]?\d*[a-z]*)',
            r'(SP\.\d+[-\.]?\d*[a-z]*)',
            r'(FIPS\.\d+[-\.]?\d*)',
        ]
        for pattern in patterns:
            match = re.search(pattern, url, re.IGNORECASE)
            if match:
                return match.group(1)
        return None

    def download_pdf(self, publication):
        """Download a single PDF."""
        # Create safe filename
        safe_title = re.sub(r'[<>:"/\\|?*]', '_', publication['title'])
        safe_title = safe_title[:150]  # Limit length
        filename = f"{safe_title}.pdf"
        filepath = self.output_dir / filename

        # Skip if already exists
        if filepath.exists():
            logger.debug(f"Already exists: {filename}")
            publication['local_path'] = str(filepath)
            publication['downloaded'] = True
            return True

        # Get PDF URL
        pdf_url = publication.get('pdf_url')
        if not pdf_url:
            pdf_url = self.get_pdf_url(publication['detail_url'])
            publication['pdf_url'] = pdf_url

        if not pdf_url:
            logger.warning(f"No PDF found for: {publication['title']}")
            publication['downloaded'] = False
            return False

        # Download PDF
        try:
            logger.info(f"Downloading: {publication['title'][:80]}...")
            response = self.session.get(pdf_url, timeout=120, stream=True)
            response.raise_for_status()

            # Save file
            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)

            publication['local_path'] = str(filepath)
            publication['downloaded'] = True

            size_mb = filepath.stat().st_size / (1024 * 1024)
            logger.info(f"✓ Downloaded: {filename[:60]} ({size_mb:.1f} MB)")
            return True

        except Exception as e:
            logger.error(f"Failed to download {publication['title']}: {e}")
            if filepath.exists():
                filepath.unlink()
            publication['downloaded'] = False
            return False

    def run(self):
        """Run the complete download process."""
        # Get search results
        html = self.get_search_results_page()
        if not html:
            logger.error("Failed to fetch search results")
            return

        # Extract publication links
        publications = self.extract_publication_links(html)

        if not publications:
            logger.error("No publications found. The page structure may have changed.")
            logger.info("Saving page HTML for debugging...")
            (self.output_dir / 'debug_page.html').write_text(html)
            return

        logger.info(f"\nFound {len(publications)} publications to download")
        logger.info(f"Estimated time: {len(publications) * self.delay / 60:.0f} minutes")
        logger.info("Starting downloads...\n")

        # Download all PDFs
        successful = 0
        failed = 0

        for pub in tqdm(publications, desc="Downloading PDFs"):
            if self.download_pdf(pub):
                successful += 1
            else:
                failed += 1
            time.sleep(self.delay)

        # Save metadata
        metadata_path = self.output_dir / 'metadata.json'
        with open(metadata_path, 'w') as f:
            json.dump(publications, f, indent=2)

        # Summary
        logger.info(f"\n" + "="*60)
        logger.info(f"Download Complete!")
        logger.info(f"="*60)
        logger.info(f"Total publications found: {len(publications)}")
        logger.info(f"Successfully downloaded: {successful}")
        logger.info(f"Failed: {failed}")
        logger.info(f"Metadata saved to: {metadata_path}")

        # Calculate total size
        total_size = sum(f.stat().st_size for f in self.output_dir.glob('*.pdf'))
        logger.info(f"Total size: {total_size / (1024**3):.2f} GB")


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description='Download all NIST FIPS, SP, and IR publications'
    )
    parser.add_argument('--output', '-o', default='data/raw',
                        help='Output directory for PDFs')
    parser.add_argument('--delay', type=float, default=1.5,
                        help='Delay between downloads in seconds (be respectful)')

    args = parser.parse_args()

    downloader = NISTDownloader(output_dir=args.output, delay=args.delay)
    downloader.run()


if __name__ == '__main__':
    main()
