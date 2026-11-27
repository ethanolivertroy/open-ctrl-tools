#!/usr/bin/env python3
"""
Scrape OWASP Top 10 lists from GitHub and convert to JSON format.
Supports: Web 2025, API 2023, Mobile 2024
"""

import json
import re
import requests
from pathlib import Path

# Base URLs for raw GitHub content
GITHUB_RAW_BASE = "https://raw.githubusercontent.com/OWASP"

# OWASP Web Top 10 2025
WEB_2025_FILES = [
    ("A01", "Broken Access Control", "A01_2025-Broken_Access_Control.md"),
    ("A02", "Security Misconfiguration", "A02_2025-Security_Misconfiguration.md"),
    ("A03", "Software Supply Chain Failures", "A03_2025-Software_Supply_Chain_Failures.md"),
    ("A04", "Cryptographic Failures", "A04_2025-Cryptographic_Failures.md"),
    ("A05", "Injection", "A05_2025-Injection.md"),
    ("A06", "Insecure Design", "A06_2025-Insecure_Design.md"),
    ("A07", "Authentication Failures", "A07_2025-Authentication_Failures.md"),
    ("A08", "Software or Data Integrity Failures", "A08_2025-Software_or_Data_Integrity_Failures.md"),
    ("A09", "Security Logging and Alerting Failures", "A09_2025-Security_Logging_and_Alerting_Failures.md"),
    ("A10", "Mishandling of Exceptional Conditions", "A10_2025-Mishandling_of_Exceptional_Conditions.md"),
]

WEB_2025_BASE = f"{GITHUB_RAW_BASE}/Top10/master/2025/docs/en"

# OWASP API Security Top 10 2023
API_2023_FILES = [
    ("API1", "Broken Object Level Authorization", "0xa1-broken-object-level-authorization.md"),
    ("API2", "Broken Authentication", "0xa2-broken-authentication.md"),
    ("API3", "Broken Object Property Level Authorization", "0xa3-broken-object-property-level-authorization.md"),
    ("API4", "Unrestricted Resource Consumption", "0xa4-unrestricted-resource-consumption.md"),
    ("API5", "Broken Function Level Authorization", "0xa5-broken-function-level-authorization.md"),
    ("API6", "Unrestricted Access to Sensitive Business Flows", "0xa6-unrestricted-access-to-sensitive-business-flows.md"),
    ("API7", "Server Side Request Forgery", "0xa7-server-side-request-forgery.md"),
    ("API8", "Security Misconfiguration", "0xa8-security-misconfiguration.md"),
    ("API9", "Improper Inventory Management", "0xa9-improper-inventory-management.md"),
    ("API10", "Unsafe Consumption of APIs", "0xaa-unsafe-consumption-of-apis.md"),
]

API_2023_BASE = f"{GITHUB_RAW_BASE}/API-Security/master/editions/2023/en"

# OWASP Mobile Top 10 2024 (files are in 2023-risks but represent 2024 release)
MOBILE_2024_FILES = [
    ("M1", "Improper Credential Usage", "m1-improper-credential-usage.md"),
    ("M2", "Inadequate Supply Chain Security", "m2-inadequate-supply-chain-security.md"),
    ("M3", "Insecure Authentication/Authorization", "m3-insecure-authentication-authorization.md"),
    ("M4", "Insufficient Input/Output Validation", "m4-insufficient-input-output-validation.md"),
    ("M5", "Insecure Communication", "m5-insecure-communication.md"),
    ("M6", "Inadequate Privacy Controls", "m6-inadequate-privacy-controls.md"),
    ("M7", "Insufficient Binary Protections", "m7-insufficient-binary-protection.md"),
    ("M8", "Security Misconfiguration", "m8-security-misconfiguration.md"),
    ("M9", "Insecure Data Storage", "m9-insecure-data-storage.md"),
    ("M10", "Insufficient Cryptography", "m10-insufficient-cryptography.md"),
]

MOBILE_2024_BASE = f"{GITHUB_RAW_BASE}/www-project-mobile-top-10/master/2023-risks"

# Family/category mappings for Web 2025
WEB_2025_FAMILIES = {
    "A01": "Access Control",
    "A02": "Configuration",
    "A03": "Supply Chain",
    "A04": "Cryptography",
    "A05": "Input Validation",
    "A06": "Design",
    "A07": "Authentication",
    "A08": "Integrity",
    "A09": "Logging & Monitoring",
    "A10": "Error Handling",
}

# Family mappings for API 2023
API_2023_FAMILIES = {
    "API1": "Authorization",
    "API2": "Authentication",
    "API3": "Authorization",
    "API4": "Resource Management",
    "API5": "Authorization",
    "API6": "Business Logic",
    "API7": "Server Security",
    "API8": "Configuration",
    "API9": "Asset Management",
    "API10": "Integration Security",
}

# Family mappings for Mobile 2024
MOBILE_2024_FAMILIES = {
    "M1": "Credential Management",
    "M2": "Supply Chain",
    "M3": "Authentication",
    "M4": "Input Validation",
    "M5": "Communication",
    "M6": "Privacy",
    "M7": "Binary Protection",
    "M8": "Configuration",
    "M9": "Data Storage",
    "M10": "Cryptography",
}


def fetch_markdown(url: str) -> str:
    """Fetch markdown content from URL."""
    print(f"  Fetching: {url}")
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.text


def extract_section(content: str, header: str) -> str:
    """Extract content between a ## header and the next ## header."""
    pattern = rf"##\s*{re.escape(header)}\.?\s*\n(.*?)(?=\n##\s|\Z)"
    match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return ""


def parse_bullet_list(text: str) -> list[str]:
    """Parse markdown bullet list into array of strings."""
    items = []
    for line in text.split("\n"):
        line = line.strip()
        if line.startswith("* ") or line.startswith("- "):
            items.append(line[2:].strip())
    return items


def parse_attack_scenarios(text: str) -> list[dict]:
    """Parse attack scenarios section into structured format."""
    scenarios = []
    # Match **Scenario #N:** pattern
    pattern = r"\*\*Scenario #(\d+):?\*\*\s*(.*?)(?=\*\*Scenario #|\Z)"
    matches = re.findall(pattern, text, re.DOTALL)

    for num, content in matches:
        # Clean up the content - remove code blocks for title extraction
        title_match = re.match(r"([^`\n]+)", content.strip())
        title = title_match.group(1).strip() if title_match else f"Scenario {num}"
        # Remove trailing punctuation from title
        title = re.sub(r"[:\.]$", "", title).strip()

        scenarios.append({
            "title": title or f"Attack Scenario {num}",
            "description": content.strip()
        })

    return scenarios


def parse_references(text: str) -> list[dict]:
    """Parse references section into structured format."""
    refs = []
    # Match markdown links: [title](url)
    pattern = r"\[([^\]]+)\]\(([^)]+)\)"
    for title, url in re.findall(pattern, text):
        refs.append({"title": title, "url": url})
    return refs


def parse_cwes(text: str) -> list[str]:
    """Extract CWE IDs from the mapped CWEs section."""
    cwes = []
    pattern = r"CWE-(\d+)"
    for cwe_id in re.findall(pattern, text):
        cwes.append(f"CWE-{cwe_id}")
    return list(set(cwes))  # Remove duplicates


def parse_web_2025_markdown(content: str, control_id: str, title: str) -> dict:
    """Parse OWASP Web 2025 markdown into control structure."""

    # Extract sections
    background = extract_section(content, "Background")
    description = extract_section(content, "Description")
    prevention = extract_section(content, "How to prevent")
    scenarios = extract_section(content, "Example attack scenarios")
    references = extract_section(content, "References")
    cwes = extract_section(content, "List of Mapped CWEs")

    # Build description from background + description
    full_description = ""
    if background:
        full_description = background
    if description:
        if full_description:
            full_description += "\n\n"
        full_description += description

    # Parse structured data
    prevention_items = parse_bullet_list(prevention)
    attack_scenarios = parse_attack_scenarios(scenarios)
    reference_list = parse_references(references)
    cwe_list = parse_cwes(cwes)

    return {
        "control_id": control_id,
        "title": title,
        "family": WEB_2025_FAMILIES.get(control_id, "General"),
        "description": full_description or f"OWASP Top 10 2025 - {title}",
        "prevention_strategies": prevention_items,
        "attack_scenarios": attack_scenarios,
        "references": reference_list,
        "related_cwes": cwe_list,
    }


def scrape_web_2025() -> dict:
    """Scrape OWASP Web Top 10 2025."""
    print("Scraping OWASP Web Top 10 2025...")

    controls = []
    for control_id, title, filename in WEB_2025_FILES:
        url = f"{WEB_2025_BASE}/{filename}"
        try:
            content = fetch_markdown(url)
            control = parse_web_2025_markdown(content, control_id, title)
            controls.append(control)
            print(f"  Parsed: {control_id} - {title}")
        except Exception as e:
            print(f"  ERROR parsing {control_id}: {e}")

    # Build families dict
    families = {}
    for control_id, desc in WEB_2025_FAMILIES.items():
        families[desc] = f"Risks related to {desc.lower()}"

    return {
        "framework": {
            "id": "owasp-web-top10",
            "name": "OWASP Top 10",
            "version": "2025",
            "description": "The OWASP Top 10 is a standard awareness document for web application security risks"
        },
        "families": families,
        "controls": controls
    }


def parse_api_2023_markdown(content: str, control_id: str, title: str) -> dict:
    """Parse OWASP API 2023 markdown into control structure."""

    # API docs use different section headers
    description = extract_section(content, "Description")
    if not description:
        # Try alternative headers
        description = extract_section(content, "What is")

    prevention = extract_section(content, "How To Prevent")
    if not prevention:
        prevention = extract_section(content, "Prevention")

    scenarios = extract_section(content, "Example Attack Scenarios")
    if not scenarios:
        scenarios = extract_section(content, "Attack Scenarios")

    references = extract_section(content, "References")

    # Parse structured data
    prevention_items = parse_bullet_list(prevention)
    attack_scenarios = parse_attack_scenarios(scenarios)
    reference_list = parse_references(references)

    return {
        "control_id": control_id,
        "title": title,
        "family": API_2023_FAMILIES.get(control_id, "General"),
        "description": description or f"OWASP API Security Top 10 2023 - {title}",
        "prevention_strategies": prevention_items,
        "attack_scenarios": attack_scenarios,
        "references": reference_list,
    }


def parse_mobile_2024_markdown(content: str, control_id: str, title: str) -> dict:
    """Parse OWASP Mobile 2024 markdown into control structure."""

    # Mobile docs have varied structure - try multiple patterns
    description = ""

    # Try to get description from various sections
    for header in ["Description", "Overview", "Threat Agents", "What is"]:
        desc = extract_section(content, header)
        if desc:
            description = desc
            break

    # If no description found, use the content after frontmatter
    if not description:
        # Remove YAML frontmatter and use first substantial paragraph
        content_clean = re.sub(r"^---.*?---\s*", "", content, flags=re.DOTALL)
        # Get first paragraph after any header
        match = re.search(r"#[^\n]+\n+(.+?)(?=\n#|\Z)", content_clean, re.DOTALL)
        if match:
            description = match.group(1).strip()

    prevention = extract_section(content, "How To Prevent")
    if not prevention:
        prevention = extract_section(content, "Prevention")
        if not prevention:
            prevention = extract_section(content, "Preventions")

    scenarios = extract_section(content, "Example Attack Scenarios")
    if not scenarios:
        scenarios = extract_section(content, "Attack Scenarios")

    references = extract_section(content, "References")

    # Parse structured data
    prevention_items = parse_bullet_list(prevention)
    attack_scenarios = parse_attack_scenarios(scenarios)
    reference_list = parse_references(references)

    return {
        "control_id": control_id,
        "title": title,
        "family": MOBILE_2024_FAMILIES.get(control_id, "General"),
        "description": description or f"OWASP Mobile Top 10 2024 - {title}",
        "prevention_strategies": prevention_items,
        "attack_scenarios": attack_scenarios,
        "references": reference_list,
    }


def scrape_api_2023() -> dict:
    """Scrape OWASP API Security Top 10 2023."""
    print("Scraping OWASP API Security Top 10 2023...")

    controls = []
    for control_id, title, filename in API_2023_FILES:
        url = f"{API_2023_BASE}/{filename}"
        try:
            content = fetch_markdown(url)
            control = parse_api_2023_markdown(content, control_id, title)
            controls.append(control)
            print(f"  Parsed: {control_id} - {title}")
        except Exception as e:
            print(f"  ERROR parsing {control_id}: {e}")

    # Build families dict
    families = {}
    for control_id, desc in API_2023_FAMILIES.items():
        families[desc] = f"Risks related to {desc.lower()}"

    return {
        "framework": {
            "id": "owasp-api-top10",
            "name": "OWASP API Security Top 10",
            "version": "2023",
            "description": "The OWASP API Security Top 10 represents the most critical security risks to APIs"
        },
        "families": families,
        "controls": controls
    }


def scrape_mobile_2024() -> dict:
    """Scrape OWASP Mobile Top 10 2024."""
    print("Scraping OWASP Mobile Top 10 2024...")

    controls = []
    for control_id, title, filename in MOBILE_2024_FILES:
        url = f"{MOBILE_2024_BASE}/{filename}"
        try:
            content = fetch_markdown(url)
            control = parse_mobile_2024_markdown(content, control_id, title)
            controls.append(control)
            print(f"  Parsed: {control_id} - {title}")
        except Exception as e:
            print(f"  ERROR parsing {control_id}: {e}")

    # Build families dict
    families = {}
    for control_id, desc in MOBILE_2024_FAMILIES.items():
        families[desc] = f"Risks related to {desc.lower()}"

    return {
        "framework": {
            "id": "owasp-mobile-top10",
            "name": "OWASP Mobile Top 10",
            "version": "2024",
            "description": "The OWASP Mobile Top 10 represents the most critical security risks to mobile applications"
        },
        "families": families,
        "controls": controls
    }


def save_json(data: dict, output_path: str):
    """Save data to JSON file."""
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Saved: {output_path}")


def main():
    output_dir = Path(__file__).parent.parent / "src" / "data"

    # Scrape Web 2025
    web_data = scrape_web_2025()
    save_json(web_data, output_dir / "owasp-web-top10.json")
    print(f"  Total: {len(web_data['controls'])} risks\n")

    # Scrape API 2023
    api_data = scrape_api_2023()
    save_json(api_data, output_dir / "owasp-api-top10.json")
    print(f"  Total: {len(api_data['controls'])} risks\n")

    # Scrape Mobile 2024
    mobile_data = scrape_mobile_2024()
    save_json(mobile_data, output_dir / "owasp-mobile-top10.json")
    print(f"  Total: {len(mobile_data['controls'])} risks\n")

    print("Done! All OWASP Top 10 lists scraped.")


if __name__ == "__main__":
    main()
