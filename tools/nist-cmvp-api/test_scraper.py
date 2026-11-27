#!/usr/bin/env python3
"""
Test script for the NIST CMVP scraper.
Tests the parsing logic with sample HTML.
"""

import asyncio
import io
import json
import os
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace
import scraper as scraper_module
from scraper import (
    ALGORITHM_CACHE_VERSION,
    ALGORITHM_EXTRACTION_SCHEMA_VERSION,
    apply_algorithm_fields,
    build_algorithm_extraction_provenance,
    build_certificate_artifacts,
    build_certificate_index_payload,
    build_certificate_fingerprint,
    build_changes_feed,
    build_data_quality_report,
    build_examples_payload,
    build_extraction_metrics,
    build_index_payload,
    build_search_index_payloads,
    create_algorithms_summary,
    extract_legacy_algorithm_section,
    extract_text_from_crawl4ai_process_result,
    extract_text_from_crawl4ai_html,
    fetch_policy_pdf_bytes,
    format_algorithm_entry,
    generate_json_schema_artifacts,
    generate_openapi_spec,
    generate_text_artifacts,
    module_rows_with_cache_fallback,
    parse_algorithms_from_policy_markdown,
    parse_algorithms_from_policy_text,
    parse_certificate_detail_page,
    parse_legacy_algorithm_rows,
    parse_modules_table,
    prepare_reused_detail_payload,
    process_certificate_record,
    prune_orphan_certificate_details,
    select_algorithm_source,
    should_reuse_certificate_detail,
    should_reuse_cached_algorithms,
)
from validate_api import validate_api


FIXTURE_DIR = Path(__file__).parent / "tests" / "fixtures" / "nist_security_policies"
FIPS_140_2_SYNTHETIC_EXPECTED_DETAILED = [
    "AES Cert. #A9002",
    "DRBG Cert. #A9002",
    "ECDSA Cert. #A9002",
    "HMAC Cert. #A9002",
    "KAS Cert. #A9002",
    "RSA Cert. #A9002",
    "SHS Cert. #A9002",
]
FIPS_140_2_SYNTHETIC_EXPECTED_CATEGORIES = [
    "AES",
    "DRBG",
    "ECDSA",
    "HMAC",
    "KAS",
    "KDF",
    "RSA",
    "SHS",
    "SSH",
    "TLS",
]


def load_policy_fixture(name: str) -> str:
    """Load a checked-in Security Policy text fixture."""
    return (FIXTURE_DIR / name).read_text(encoding="utf-8")


def test_parse_simple_table():
    """Test parsing a simple HTML table."""
    html = """
    <html>
        <body>
            <table>
                <thead>
                    <tr>
                        <th>Certificate Number</th>
                        <th>Vendor</th>
                        <th>Module Name</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>1234</td>
                        <td>Test Vendor</td>
                        <td><a href="/test">Test Module</a></td>
                    </tr>
                    <tr>
                        <td>5678</td>
                        <td>Another Vendor</td>
                        <td>Another Module</td>
                    </tr>
                </tbody>
            </table>
        </body>
    </html>
    """
    
    modules = parse_modules_table(html)
    
    assert len(modules) == 2, f"Expected 2 modules, got {len(modules)}"
    assert modules[0]["Certificate Number"] == "1234", "First module certificate mismatch"
    assert modules[0]["Vendor"] == "Test Vendor", "First module vendor mismatch"
    assert modules[0]["Module Name"] == "Test Module", "First module name mismatch"
    assert "Module Name_url" in modules[0], "Expected URL field for module name"
    assert modules[0]["Module Name_url"] == "https://csrc.nist.gov/test", "URL should be absolute"
    
    assert modules[1]["Certificate Number"] == "5678", "Second module certificate mismatch"
    
    print("✓ Simple table test passed")


def test_parse_table_without_thead():
    """Test parsing a table without explicit thead."""
    html = """
    <html>
        <body>
            <table>
                <tr>
                    <th>ID</th>
                    <th>Name</th>
                </tr>
                <tr>
                    <td>100</td>
                    <td>Module A</td>
                </tr>
            </table>
        </body>
    </html>
    """
    
    modules = parse_modules_table(html)
    
    assert len(modules) == 1, f"Expected 1 module, got {len(modules)}"
    assert modules[0]["ID"] == "100", "Module ID mismatch"
    assert modules[0]["Name"] == "Module A", "Module name mismatch"
    
    print("✓ Table without thead test passed")


def test_parse_empty_table():
    """Test parsing an empty table."""
    html = """
    <html>
        <body>
            <table>
                <thead>
                    <tr>
                        <th>Column 1</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            </table>
        </body>
    </html>
    """
    
    modules = parse_modules_table(html)
    
    assert len(modules) == 0, f"Expected 0 modules, got {len(modules)}"
    
    print("✓ Empty table test passed")


def test_parse_historical_modules_table():
    """Test parsing a table with historical modules format."""
    html = """
    <html>
        <body>
            <table>
                <thead>
                    <tr>
                        <th>Certificate Number</th>
                        <th>Vendor Name</th>
                        <th>Module Name</th>
                        <th>Module Type</th>
                        <th>Validation Date</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><a href="/cert/9999">9999</a></td>
                        <td>Historical Vendor</td>
                        <td>Historical Crypto Module</td>
                        <td>Software</td>
                        <td>01/01/2010</td>
                    </tr>
                    <tr>
                        <td><a href="/cert/8888">8888</a></td>
                        <td>Old Corp</td>
                        <td>Legacy Module</td>
                        <td>Hardware</td>
                        <td>12/31/2009</td>
                    </tr>
                </tbody>
            </table>
        </body>
    </html>
    """
    
    modules = parse_modules_table(html)
    
    assert len(modules) == 2, f"Expected 2 modules, got {len(modules)}"
    assert modules[0]["Certificate Number"] == "9999", "First historical module certificate mismatch"
    assert modules[0]["Vendor Name"] == "Historical Vendor", "First historical module vendor mismatch"
    assert modules[0]["Module Name"] == "Historical Crypto Module", "First historical module name mismatch"
    assert "Certificate Number_url" in modules[0], "Expected URL field for certificate number"
    
    assert modules[1]["Certificate Number"] == "8888", "Second historical module certificate mismatch"
    assert modules[1]["Validation Date"] == "12/31/2009", "Second historical module date mismatch"
    
    print("✓ Historical modules table test passed")


def test_parse_modules_in_process():
    """Test parsing modules in process table structure."""
    html = """
    <html>
        <body>
            <table>
                <thead>
                    <tr>
                        <th>Lab Code</th>
                        <th>Vendor Name</th>
                        <th>Module Name</th>
                        <th>Module Type</th>
                        <th>Module Version</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>1234</td>
                        <td>Test Vendor</td>
                        <td><a href="/modules/test">Test Module In Process</a></td>
                        <td>Software</td>
                        <td>1.0</td>
                    </tr>
                </tbody>
            </table>
        </body>
    </html>
    """
    
    modules = parse_modules_table(html)
    
    assert len(modules) == 1, f"Expected 1 module, got {len(modules)}"
    assert modules[0]["Lab Code"] == "1234", "Lab Code mismatch"
    assert modules[0]["Vendor Name"] == "Test Vendor", "Vendor Name mismatch"
    assert modules[0]["Module Name"] == "Test Module In Process", "Module Name mismatch"
    assert modules[0]["Module Type"] == "Software", "Module Type mismatch"
    assert modules[0]["Module Version"] == "1.0", "Module Version mismatch"
    assert "Module Name_url" in modules[0], "Expected URL field for module name"
    
    print("✓ Modules in process table test passed")


def test_parse_table_preserves_inline_spacing():
    """Test table cells with adjacent text nodes keep readable spacing."""
    html = """
    <html>
        <body>
            <table>
                <thead>
                    <tr>
                        <th>Certificate Number</th>
                        <th>Vendor Name</th>
                        <th>Validation Date</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>911</td>
                        <td>L3Harris Technologies, Inc.</td>
                        <td><span>02/07/2008</span><span>07/02/2010</span><span>04/10/2015</span></td>
                    </tr>
                    <tr>
                        <td></td>
                        <td>Samsung Electronics Co., Ltd.<a href="/contacts">View Contacts</a></td>
                        <td>Pending Review  (1/7/2026)</td>
                    </tr>
                </tbody>
            </table>
        </body>
    </html>
    """

    modules = parse_modules_table(html)

    assert modules[0]["Validation Date"] == "02/07/2008 07/02/2010 04/10/2015", "Validation dates should preserve spacing"
    assert modules[1]["Vendor Name"] == "Samsung Electronics Co., Ltd. View Contacts", "Inline contact link should preserve spacing"

    print("✓ Inline table spacing test passed")


def test_parse_certificate_detail_page():
    """Test parsing a NIST-style certificate detail page."""
    html = """
    <html>
      <body>
        <div class="panel panel-default">
          <div class="panel-heading"><h4 class="panel-title">Details</h4></div>
          <div class="panel-body">
            <div class="row padrow">
              <div class="col-md-3"><span>Module Name</span></div>
              <div class="col-md-9" id="module-name">OVHCloud OKMS Provider based on the OpenSSL FIPS Provider</div>
            </div>
            <div class="row padrow">
              <div class="col-md-3">Standard</div>
              <div class="col-md-9" id="module-standard">FIPS 140-3</div>
            </div>
            <div class="row padrow">
              <div class="col-md-3">Status</div>
              <div class="col-md-9">Active</div>
            </div>
            <div class="row padrow">
              <div class="col-md-3"><span>Sunset Date</span></div>
              <div class="col-md-9">3/10/2030</div>
            </div>
            <div class="row padrow">
              <div class="col-md-3"><span>Overall Level</span></div>
              <div class="col-md-9">1</div>
            </div>
            <div class="row padrow">
              <div class="col-md-3"><span>Caveat</span></div>
              <div class="col-md-9"><span class="alert-danger">When operated in approved mode.</span></div>
            </div>
            <div class="row padrow">
              <div class="col-md-3"><span>Security Level Exceptions</span></div>
              <div class="col-md-9">
                <ul class="list-left15pxPadding">
                  <li>Physical security: N/A</li>
                  <li>Life-cycle assurance: Level 3</li>
                </ul>
              </div>
            </div>
            <div class="row padrow">
              <div class="col-md-3"><span>Module Type</span></div>
              <div class="col-md-9">Software</div>
            </div>
            <div class="row padrow">
              <div class="col-md-3"><span>Embodiment</span></div>
              <div class="col-md-9" id="embodiment-name">MultiChipStand</div>
            </div>
            <div class="row padrow">
              <div class="col-md-3"><span>Description</span></div>
              <div class="col-md-9">A software library providing cryptographic functionality.</div>
            </div>
            <div class="row padrow">
              <div class="col-md-3"><span>Software Versions</span></div>
              <div class="col-md-9">OpenSSL FIPS Provider 3.0.9, 3.0.10</div>
            </div>
            <div class="row padrow">
              <div class="col-md-3"><span>Hardware Versions</span></div>
              <div class="col-md-9">N/A</div>
            </div>
            <div class="row padrow">
              <div class="col-md-3"><span>Firmware Versions</span></div>
              <div class="col-md-9">Firmware 1.2.3</div>
            </div>
          </div>
        </div>

        <div class="panel panel-default">
          <div class="panel-heading"><h4 class="panel-title">Vendor</h4></div>
          <div class="panel-body">
            <a href="https://corporate.ovhcloud.com/en/">OVH SAS</a><br />
            <span class="indent">2 RUE KELLERMANN</span><br />
            <span class="indent">ROUBAIX 59100</span><br />
            <span class="indent">FRANCE</span><br /><br />
            <div style="font-size: 0.9em;">
              <span>
                Data security team<br />
                <span class="indent"><a class="__cf_email__" data-cfemail="b5daded8c6ead3dcc5c6f5dac3dd9bdbd0c1" href="/cdn-cgi/l/email-protection">[email&#160;protected]</a></span><br />
                <span class="indent">Phone: +33 3 20 82 73 32</span><br />
              </span>
            </div>
          </div>
        </div>

        <div class="panel panel-default">
          <div class="panel-heading"><h4 class="panel-title">Related Files</h4></div>
          <div class="panel-body">
            <a href="/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp5203.pdf">Security Policy</a><br />
            <a href="https://example.test/other.pdf">Implementation Guidance</a>
          </div>
        </div>

        <div class="panel panel-default">
          <div class="panel-heading"><h4 class="panel-title">Validation History</h4></div>
          <div class="panel-body">
            <table class="table table-condensed table-striped nolinetable" id="validation-history-table">
              <thead>
                <tr><th>Date</th><th>Type</th><th>Lab</th></tr>
              </thead>
              <tbody>
                <tr><td class="text-nowrap">3/21/2026</td><td>Initial</td><td>Lightship Security, Inc.</td></tr>
                <tr><td class="text-nowrap">4/01/2026</td><td>Updated</td><td>Lightship Security, Inc.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </body>
    </html>
    """

    payload = parse_certificate_detail_page(
        html,
        5203,
        summary_module={
            "Vendor Name": "OVH SAS",
            "Module Name": "OVHCloud OKMS Provider based on the OpenSSL FIPS Provider",
            "algorithms": ["AES", "HMAC"],
            "security_policy_url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp5203.pdf",
        },
        dataset="active",
        generated_at="2026-03-26T00:00:00.000000Z",
    )

    assert payload["certificate_number"] == "5203", "Certificate number mismatch"
    assert payload["dataset"] == "active", "Dataset mismatch"
    assert payload["module_name"] == "OVHCloud OKMS Provider based on the OpenSSL FIPS Provider", "Module name mismatch"
    assert payload["standard"] == "FIPS 140-3", "Standard mismatch"
    assert payload["status"] == "Active", "Status mismatch"
    assert payload["sunset_date"] == "3/10/2030", "Sunset date mismatch"
    assert payload["overall_level"] == 1, "Overall level mismatch"
    assert payload["security_level_exceptions"] == ["Physical security: N/A", "Life-cycle assurance: Level 3"], "Security level exceptions mismatch"
    assert payload["vendor"]["name"] == "OVH SAS", "Vendor name mismatch"
    assert payload["vendor"]["contact_name"] == "Data security team", "Vendor contact mismatch"
    assert payload["vendor"]["contact_email"] == "okms_fips@ovh.net", "Vendor email mismatch"
    assert payload["vendor"]["contact_phone"] == "+33 3 20 82 73 32", "Vendor phone mismatch"
    assert payload["related_files"][0]["label"] == "Security Policy", "Related file label mismatch"
    assert payload["related_files"][0]["url"].endswith("140sp5203.pdf"), "Related file URL mismatch"
    assert len(payload["validation_history"]) == 2, "Validation history row count mismatch"
    assert payload["validation_history"][1]["type"] == "Updated", "Validation history type mismatch"
    assert payload["validation_dates"] == ["3/21/2026", "4/01/2026"], "Validation dates mismatch"
    assert payload["algorithms"] == ["AES", "HMAC"], "Algorithm list mismatch"
    assert payload["software_versions"] == "OpenSSL FIPS Provider 3.0.9, 3.0.10", "Software versions mismatch"
    assert payload["hardware_versions"] == "N/A", "Hardware versions mismatch"
    assert payload["firmware_versions"] == "Firmware 1.2.3", "Firmware versions mismatch"

    print("✓ Certificate detail page test passed")


def test_reused_certificate_detail_migrates_version_schema_fields():
    """Cached detail reuse should tolerate migratable version fields from older artifacts."""
    previous_module = {"Certificate Number": "5203", "Vendor Name": "OVH SAS"}
    previous_detail = {
        "standard": "FIPS 140-3",
        "status": "Active",
        "related_files": [],
        "validation_history": [],
        "vendor": {},
    }
    current_fingerprint = build_certificate_fingerprint(previous_module, "active")
    previous_fingerprint = build_certificate_fingerprint(previous_module, "active")

    assert should_reuse_certificate_detail(
        previous_module,
        previous_detail,
        previous_fingerprint,
        current_fingerprint,
    ), "Missing migratable version fields should not force HTML refresh"

    reused_payload = prepare_reused_detail_payload(
        previous_detail,
        previous_module,
        5203,
        "active",
        "2026-03-26T00:00:00.000000Z",
    )
    for field in ("software_versions", "hardware_versions", "firmware_versions"):
        assert field in reused_payload, f"Reused payload should migrate {field}"

    incomplete_detail = {"standard": "FIPS 140-3"}
    assert not should_reuse_certificate_detail(
        previous_module,
        incomplete_detail,
        previous_fingerprint,
        current_fingerprint,
    ), "Missing core detail fields should still force HTML refresh"

    print("✓ Certificate detail reuse schema test passed")


def test_process_certificate_record_reuses_legacy_detail_with_migrated_fields():
    """Legacy cached detail payloads should be upgraded in-place without refetching HTML."""
    module = {
        "Certificate Number": "5203",
        "Vendor Name": "OVH SAS",
        "Module Name": "OVHCloud OKMS Provider based on the OpenSSL FIPS Provider",
        "Module Type": "Software",
        "Validation Date": "04/01/2026",
        "security_policy_url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp5203.pdf",
        "certificate_detail_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5203",
    }
    previous_module = dict(module)
    previous_module["algorithms"] = ["AES"]
    previous_detail = {
        "certificate_number": "5203",
        "dataset": "active",
        "generated_at": "2026-03-26T00:00:00.000000Z",
        "nist_page_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5203",
        "certificate_detail_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5203",
        "security_policy_url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp5203.pdf",
        "vendor_name": "OVH SAS",
        "module_name": "OVHCloud OKMS Provider based on the OpenSSL FIPS Provider",
        "standard": "FIPS 140-3",
        "status": "Active",
        "related_files": [],
        "validation_history": [],
        "vendor": {},
        "algorithms": ["AES"],
    }
    previous_metadata = {
        "algorithm_source": "firecrawl",
        "algorithm_cache_version": ALGORITHM_CACHE_VERSION,
    }

    async def scenario():
        return await process_certificate_record(
            module,
            "active",
            "2026-05-14T00:00:00.000000Z",
            "crawl4ai",
            previous_module,
            previous_detail,
            previous_metadata,
            SimpleNamespace(),
            asyncio.Semaphore(1),
            asyncio.Semaphore(1),
            {},
            asyncio.Lock(),
            {},
        )

    module_out, detail_payload, categories, stats = asyncio.run(scenario())

    assert stats["html_reused"] == 1, "Matching legacy detail should be reused"
    assert stats["html_refreshed"] == 0, "Legacy detail migration should not refetch HTML"
    assert stats["pdf_reused"] == 1, "Cached algorithms should be reused with matching fingerprint"
    assert module_out["detail_available"] is True, "Reused detail should mark detail_available"
    assert categories == ["AES"], "Cached algorithm categories should be returned"
    for field in ("software_versions", "hardware_versions", "firmware_versions"):
        assert field in detail_payload, f"Reused detail should include migrated {field}"
    assert detail_payload["algorithm_extraction"]["status"] == "cached", "Cached provenance should be attached"
    assert detail_payload["algorithm_extraction"]["source"] == "firecrawl", "Original cached source should be preserved"

    print("✓ Legacy detail migration reuse test passed")


def test_parse_algorithms_from_policy_text():
    """Test extracting algorithms from Security Policy text without leaking contact data."""
    policy_text = """
    Prepared for:
    Akeyless Security ltd.
    Shai Onn
    shai@akeyless.io

    Table of Contents
    2.5 Algorithms ........................................ 8
    2.6 Security Function Implementations ............... 15

    2.5 Algorithms
    Approved Algorithms:
    Cipher
    Algorithm CAVP Cert Properties Reference
    AES-CBC A4481 Direction - Decrypt, Encrypt SP 800-38A
    Key Length - 128, 192, 256
    AES-GCM A4481 Direction - Decrypt, Encrypt SP 800-38D
    IV Generation - External, Internal
    HMAC SHA2-256 A4481 Message Authentication FIPS 198-1
    Table 6: Approved Algorithms - Cipher
    2.6 Security Function Implementations
    """

    detailed, categories = parse_algorithms_from_policy_text(policy_text)

    assert any("AES-CBC" in entry for entry in detailed), "Expected AES-CBC detailed entry"
    assert any("AES-GCM" in entry for entry in detailed), "Expected AES-GCM detailed entry"
    assert any("HMAC" in entry for entry in detailed), "Expected HMAC detailed entry"
    assert all("Shai Onn" not in entry for entry in detailed), "Contact names must not leak into algorithms"
    assert all("@" not in entry for entry in detailed), "Email addresses must not leak into algorithms"
    assert categories == ["AES", "HMAC"], "Expected normalized algorithm categories"

    print("✓ Security Policy algorithm parsing test passed")


def test_algorithm_detail_cleanup_removes_pdf_boilerplate():
    """Detailed algorithm rows should not retain PDF headers, footers, or section spillover."""
    formatted = format_algorithm_entry(
        [
            "AES-GCM | A4995 | FIPS 140-3 Non-Proprietary Security Policy",
            "© 2025 Intel Corporation",
            "This document can be reproduced and distributed only whole and intact.",
            "Cert",
        ]
    )
    assert formatted == "AES-GCM | A4995", "Formatter should cut security-policy boilerplate from table rows"

    policy_text = """
    2.5 Algorithms
    Approved Algorithms
    Algorithm CAVP Cert Properties Reference
    AES-CBC
    Key Length - 256
    A4995
    FIPS 140-3 Non-Proprietary Security Policy
    © 2025 Intel Corporation
    This document can be reproduced and distributed only whole and intact.
    Cert
    HMAC-SHA2-256 A4996 Message Authentication FIPS 198-1
    2.6 Security Function Implementations
    """

    detailed, categories = parse_algorithms_from_policy_text(policy_text)

    assert any(entry == "AES-CBC | Key Length - 256 | A4995" for entry in detailed), "Expected cleaned AES detail row"
    assert any(entry.startswith("HMAC-SHA2-256 A4996") for entry in detailed), "Expected HMAC detail row"
    assert all("Non-Proprietary Security Policy" not in entry for entry in detailed), "Policy title must not leak into details"
    assert all("Intel" not in entry for entry in detailed), "Copyright footer must not leak into details"
    assert all("This document can be reproduced" not in entry for entry in detailed), "Reproduction notice must not leak into details"
    assert all(not entry.endswith("| Cert") for entry in detailed), "Standalone Cert header must not leak into details"
    assert categories == ["AES", "HMAC"], "Expected cleaned rows to preserve categories"

    record = {}
    apply_algorithm_fields(
        record,
        ["AES"],
        ["AES-CTR A4995 | FIPS 140-3 Non-Proprietary Security Policy | © 2025 Intel Corporation | Cert"],
    )
    assert record["algorithms_detailed"] == ["AES-CTR A4995"], "Cached detailed rows should be sanitized when reapplied"

    print("✓ Algorithm detail cleanup test passed")


def test_parse_algorithms_from_legacy_policy_text():
    """Test extracting coarse categories from older FIPS 140-2 approved-function sections."""
    policy_text = """
    Table of contents
    3.4 Algorithms ........................................ 11
    3.5 Allowed Algorithms ............................... 15

    3.4 Algorithms
    Table 7 lists the approved algorithms, the CAVP certificates, and other associated information.
    Algorithm
    AES
    DRBG
    SHA-256, SHA-384, SHA-512
    HMAC-SHA-256
    KAS-ECC-SSC
    KDF TLS
    TLS v1.2
    Table 7: Approved Cryptographic Algorithms

    3.5 Allowed Algorithms
    Table 8 describes the non-approved but allowed algorithms in FIPS mode:
    Algorithm
    Triple-DES
    """

    detailed, categories = parse_algorithms_from_policy_text(policy_text)

    assert detailed == [], "Legacy fallback should preserve coarse categories without fabricated detail rows"
    assert categories == ["AES", "DRBG", "HMAC", "KAS", "KDF", "SHA", "TLS"], "Expected legacy approved-section categories"
    assert "DES" not in categories, "Non-approved section content must not leak into approved categories"

    print("✓ Legacy Security Policy parsing test passed")


def test_extract_legacy_algorithm_section_prefers_body_over_toc():
    """Legacy extractor should use the real section body instead of the table of contents copy."""
    policy_text = """
    Table of contents
    4.1.1 FIPS Approved Algorithms ........ 12
    4.1.2 FIPS Non-Approved but Allowed Algorithms ........ 16

    4.1.1 FIPS Approved Algorithms
    The module supports the following FIPS-approved cryptographic algorithms.
    Table 9 : FIPS Approved Algorithms
    AES
    DRBG
    KDF TLS
    """

    section = extract_legacy_algorithm_section(policy_text)

    assert "The module supports the following FIPS-approved cryptographic algorithms." in section, "Expected body content, not just TOC content"
    assert "........ 12" not in section, "TOC dot leaders should not outrank the real section body"

    print("✓ Legacy algorithm section TOC preference test passed")


def test_parse_real_world_fips_140_3_policy_fixture():
    """Regression-test a synthetic FIPS 140-3 NIST Security Policy text fixture."""
    policy_text = load_policy_fixture("synthetic_fips_140_3_algorithms.txt")

    detailed, categories = parse_algorithms_from_policy_text(policy_text)

    assert any("AES-CBC" in entry for entry in detailed), "Expected AES-CBC from FIPS 140-3 fixture"
    assert any("HMAC SHA2-256" in entry for entry in detailed), "Expected HMAC from FIPS 140-3 fixture"
    assert any("CTR_DRBG" in entry for entry in detailed), "Expected DRBG from FIPS 140-3 fixture"
    assert categories == ["AES", "DRBG", "HMAC", "SHA"], "Expected normalized FIPS 140-3 categories"

    print("✓ Synthetic FIPS 140-3 fixture parsing test passed")


def test_parse_real_world_fips_140_2_policy_fixture():
    """Regression-test a synthetic FIPS 140-2 NIST Security Policy text fixture."""
    policy_text = load_policy_fixture("synthetic_fips_140_2_algorithms.txt")

    detailed, categories = parse_algorithms_from_policy_text(policy_text)

    assert detailed == FIPS_140_2_SYNTHETIC_EXPECTED_DETAILED, "Expected legacy certificate-backed detail rows"
    assert categories == FIPS_140_2_SYNTHETIC_EXPECTED_CATEGORIES, "Expected normalized FIPS 140-2 categories"
    assert "DES" not in categories, "Allowed/non-approved section must not leak into approved categories"

    print("✓ Synthetic FIPS 140-2 fixture parsing test passed")


def test_parse_real_world_fips_140_2_policy_fixture_without_algorithm_heading():
    """Legacy parser should start from the approved table intro if the heading is missing."""
    policy_text = load_policy_fixture("synthetic_fips_140_2_algorithms_no_heading.txt")

    detailed, categories = parse_algorithms_from_policy_text(policy_text)

    assert detailed == FIPS_140_2_SYNTHETIC_EXPECTED_DETAILED, "Expected intro-start fixture detail rows"
    assert categories == FIPS_140_2_SYNTHETIC_EXPECTED_CATEGORIES, "Expected intro-start fixture categories"
    assert "DES" not in categories, "Allowed/non-approved section must not leak into approved categories"

    print("✓ FIPS 140-2 intro-sentence legacy parsing test passed")


def test_parse_real_world_fips_140_2_policy_fixture_unnumbered_allowed_stop():
    """Legacy parser should stop at unnumbered allowed-algorithm headings."""
    policy_text = load_policy_fixture("synthetic_fips_140_2_algorithms_unnumbered_allowed.txt")

    detailed, categories = parse_algorithms_from_policy_text(policy_text)

    assert detailed == FIPS_140_2_SYNTHETIC_EXPECTED_DETAILED, "Expected unnumbered-stop fixture detail rows"
    assert categories == FIPS_140_2_SYNTHETIC_EXPECTED_CATEGORIES, "Expected unnumbered-stop fixture categories"
    assert "DES" not in categories, "Unnumbered Allowed Algorithms section must not leak DES"

    print("✓ FIPS 140-2 unnumbered allowed-section stop test passed")


def test_parse_legacy_algorithm_rows_extracts_certificate_rows():
    """Legacy row extraction should keep approved algorithm rows with certificate references."""
    policy_text = load_policy_fixture("synthetic_fips_140_2_algorithms.txt")
    section = extract_legacy_algorithm_section(policy_text)

    detailed = parse_legacy_algorithm_rows(section)

    assert detailed == FIPS_140_2_SYNTHETIC_EXPECTED_DETAILED, "Expected certificate-backed legacy detail rows"
    assert "AES Cert. #A9002" in detailed, "Expected AES certificate row"
    assert "SHS Cert. #A9002" in detailed, "Expected SHS certificate row"
    assert all("Triple-DES" not in entry for entry in detailed), "Allowed Triple-DES row must not leak into details"

    print("✓ Legacy certificate-row extraction test passed")


def test_parse_algorithms_from_policy_markdown():
    """Test parsing algorithm tables from policy markdown output."""
    markdown = """
    2.5 Algorithms

    Approved Algorithms:

    | Algorithm | CAVP Cert | Properties | Reference |
    | --- | --- | --- | --- |
    | AES-CBC | A4481 | Direction - Decrypt, Encrypt Key Length - 128, 192, 256 | SP 800-38A |
    | HMAC SHA2-256 | A4481 | Message Authentication | FIPS 198-1 |
    | RSA SigGen | A4481 | Modulo - 2048, 3072 | FIPS 186-4 |
    |  |  | Key Transport Method - KTS-OAEP-basic |  |

    2.6 Security Function Implementations
    """

    detailed, categories = parse_algorithms_from_policy_markdown(markdown)

    assert any("AES-CBC" in entry for entry in detailed), "Expected AES-CBC row from policy markdown"
    assert any("HMAC SHA2-256" in entry for entry in detailed), "Expected HMAC row from policy markdown"
    assert any("RSA SigGen" in entry for entry in detailed), "Expected RSA row from policy markdown"
    assert all("Key Transport Method" not in entry for entry in detailed), "Blank algorithm-name rows must be ignored"
    assert categories == ["AES", "HMAC", "RSA"], "Expected normalized categories from policy markdown"

    print("✓ Policy markdown algorithm parsing test passed")


def test_extract_text_from_crawl4ai_html():
    """Test converting Crawl4AI PDF HTML into parser-friendly policy text."""
    html = """
    <html>
      <body>
        <p>2.5 Algorithms</p>
        <p>Approved Algorithms:</p>
        <p>Cipher</p>
        <p>Algorithm CAVP Cert Properties Reference</p>
        <p>AES-GCM A4481 Direction - Decrypt, Encrypt SP 800-38D</p>
        <p>HMAC SHA2-256 A4481 Message Authentication FIPS 198-1</p>
        <p>2.6 Security Function Implementations</p>
      </body>
    </html>
    """

    policy_text = extract_text_from_crawl4ai_html(html)
    detailed, categories = parse_algorithms_from_policy_text(policy_text)

    assert "2.5 Algorithms" in policy_text, "Expected section heading in extracted text"
    assert any("AES-GCM" in entry for entry in detailed), "Expected AES row from Crawl4AI HTML"
    assert any("HMAC SHA2-256" in entry for entry in detailed), "Expected HMAC row from Crawl4AI HTML"
    assert categories == ["AES", "HMAC"], "Expected normalized categories from Crawl4AI HTML"

    print("✓ Crawl4AI HTML text extraction test passed")


def test_extract_text_from_crawl4ai_process_result():
    """Test preserving raw Crawl4AI PDF processor page text."""
    process_result = SimpleNamespace(
        pages=[
            SimpleNamespace(
                raw_text="""
                2.5 Algorithms
                Approved Algorithms:
                Cipher
                Algorithm CAVP Cert Properties Reference
                AES-GCM A4481 Direction - Decrypt, Encrypt SP 800-38D
                HMAC SHA2-256 A4481 Message Authentication FIPS 198-1
                2.6 Security Function Implementations
                """,
                markdown="",
            )
        ]
    )

    policy_text = extract_text_from_crawl4ai_process_result(process_result)
    detailed, categories = parse_algorithms_from_policy_text(policy_text)

    assert any("AES-GCM" in entry for entry in detailed), "Expected AES row from Crawl4AI raw text"
    assert any("HMAC SHA2-256" in entry for entry in detailed), "Expected HMAC row from Crawl4AI raw text"
    assert categories == ["AES", "HMAC"], "Expected normalized categories from Crawl4AI raw text"

    print("✓ Crawl4AI raw processor text extraction test passed")


def test_select_algorithm_source():
    """Test algorithm source selection and fallback behavior."""
    assert select_algorithm_source("", False, "", True) == "crawl4ai", "Crawl4AI should be the default when available"
    assert select_algorithm_source("", False, "", False) == "security_policy_pdf", "Local PDF parser should be the fallback"
    assert select_algorithm_source("security_policy_pdf", False, "", True) == "security_policy_pdf", "Explicit local parser should be honored"
    assert select_algorithm_source("local-pdf", False, "", True) == "security_policy_pdf", "Hyphenated local PDF alias should work"
    assert select_algorithm_source("firecrawl", False, "", True) == "crawl4ai", "Deprecated Firecrawl setting should map to Crawl4AI"
    assert select_algorithm_source("", True, "", True) == "none", "SKIP_ALGORITHMS should disable extraction"
    assert select_algorithm_source("", False, "/tmp/cmvp.db", True) == "database", "Database import should take precedence"

    try:
        select_algorithm_source("database", False, "", True)
    except ValueError:
        pass
    else:
        raise AssertionError("ALGORITHM_SOURCE=database should require CMVP_DB_PATH")

    print("✓ Algorithm source selection test passed")


def test_build_certificate_fingerprint():
    """Test that certificate fingerprints are stable and change when summary fields change."""
    base_row = {
        "Certificate Number": "5238",
        "Vendor Name": "SUSE LLC",
        "Module Name": "SUSE Linux Enterprise OpenSSL 1 Cryptographic Module",
        "Module Type": "Software",
        "Validation Date": "04/10/2026",
        "security_policy_url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp5238.pdf",
        "certificate_detail_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5238",
    }

    same_row = dict(base_row)
    changed_row = dict(base_row)
    changed_row["Validation Date"] = "04/11/2026"
    spacing_fixed_row = dict(base_row)
    spacing_fixed_row["Validation Date"] = "04/10/2026 05/12/2026"
    spacing_broken_row = dict(base_row)
    spacing_broken_row["Validation Date"] = "04/10/202605/12/2026"
    two_digit_year_fixed_row = dict(base_row)
    two_digit_year_fixed_row["Validation Date"] = "10/25/2010 01/31/11 03/14/2011"
    two_digit_year_broken_row = dict(base_row)
    two_digit_year_broken_row["Validation Date"] = "10/25/201001/31/1103/14/2011"
    module_spacing_fixed_row = dict(base_row)
    module_spacing_fixed_row["Module Name"] = "P7170 IP System Portable Two-Way FM Radios"
    module_spacing_broken_row = dict(base_row)
    module_spacing_broken_row["Module Name"] = "P7170IPSystem Portable Two-Way FM Radios"
    module_changed_row = dict(base_row)
    module_changed_row["Module Name"] = "P7171 IP System Portable Two-Way FM Radios"

    fingerprint = build_certificate_fingerprint(base_row, "active")
    assert fingerprint == build_certificate_fingerprint(same_row, "active"), "Fingerprint should be stable for unchanged rows"
    assert fingerprint != build_certificate_fingerprint(changed_row, "active"), "Fingerprint should change when summary fields change"
    assert fingerprint != build_certificate_fingerprint(base_row, "historical"), "Fingerprint should change when dataset changes"
    assert (
        build_certificate_fingerprint(spacing_fixed_row, "active")
        == build_certificate_fingerprint(spacing_broken_row, "active")
    ), "Fingerprint should ignore HTML spacing artifacts between adjacent validation dates"
    assert (
        build_certificate_fingerprint(two_digit_year_fixed_row, "active")
        == build_certificate_fingerprint(two_digit_year_broken_row, "active")
    ), "Fingerprint should handle adjacent validation dates that include a two-digit year"
    assert (
        build_certificate_fingerprint(module_spacing_fixed_row, "active")
        == build_certificate_fingerprint(module_spacing_broken_row, "active")
    ), "Fingerprint should ignore HTML spacing artifacts inside module names"
    assert (
        build_certificate_fingerprint(module_spacing_fixed_row, "active")
        != build_certificate_fingerprint(module_changed_row, "active")
    ), "Fingerprint should still change when module name text changes"

    print("✓ Certificate fingerprint test passed")


def test_should_reuse_cached_algorithms():
    """Empty cached algorithm payloads should be retried after parser-version upgrades."""
    previous_module_with_algorithms = {"algorithms": ["AES"], "algorithms_detailed": []}
    previous_module_empty = {"algorithms": [], "algorithms_detailed": []}

    same_version_metadata = {
        "algorithm_source": "crawl4ai",
        "algorithm_cache_version": ALGORITHM_CACHE_VERSION,
    }
    old_version_metadata = {
        "algorithm_source": "crawl4ai",
        "algorithm_cache_version": "older-version",
    }

    assert should_reuse_cached_algorithms(
        "crawl4ai",
        True,
        same_version_metadata,
        previous_module_empty,
        None,
    ), "Matching cache versions should reuse even empty payloads"

    assert should_reuse_cached_algorithms(
        "crawl4ai",
        True,
        old_version_metadata,
        previous_module_with_algorithms,
        None,
    ), "Non-empty cached payloads should be reused across parser-version bumps and source migrations"

    assert not should_reuse_cached_algorithms(
        "crawl4ai",
        True,
        old_version_metadata,
        previous_module_empty,
        None,
    ), "Empty cached payloads should be retried after parser-version bumps"

    assert not should_reuse_cached_algorithms(
        "crawl4ai",
        False,
        same_version_metadata,
        previous_module_with_algorithms,
        None,
    ), "Fingerprint mismatches should never reuse cached algorithms"

    print("✓ Algorithm cache reuse test passed")


def test_algorithm_extraction_provenance_and_metrics():
    """Algorithm extraction provenance should expose source, cache, fallback, and counts."""
    provenance = build_algorithm_extraction_provenance(
        "crawl4ai",
        "parsed",
        "security_policy_pdf",
        "https://csrc.nist.gov/example.pdf",
        ["AES", "HMAC"],
        ["AES-CBC A1", "HMAC SHA2-256 A1"],
        cached=False,
        fallback_used=True,
        attempts=[
            {"source": "crawl4ai", "url": "https://csrc.nist.gov/example.pdf", "status": "no_algorithms"},
            {"source": "security_policy_pdf", "url": "https://csrc.nist.gov/example.pdf", "status": "parsed"},
        ],
    )

    assert provenance["schema_version"] == ALGORITHM_EXTRACTION_SCHEMA_VERSION, "Provenance schema version mismatch"
    assert provenance["configured_source"] == "crawl4ai", "Configured source should be recorded"
    assert provenance["source"] == "security_policy_pdf", "Actual extraction source should be recorded"
    assert provenance["fallback_used"] is True, "Fallback usage should be recorded"
    assert provenance["algorithm_count"] == 2, "Algorithm category count mismatch"
    assert provenance["detailed_algorithm_count"] == 2, "Detailed algorithm count mismatch"
    assert len(provenance["attempts"]) == 2, "Attempt provenance should be retained for detail records"

    active_stats = {"html_reused": 3, "algorithm_successes": 2, "algorithm_fallbacks": 1, "certificate_timeouts": 1}
    historical_stats = {"html_refreshed": 4, "algorithm_misses": 1}
    metrics = build_extraction_metrics(active_stats, historical_stats)
    assert metrics["combined"]["html_reused"] == 3, "Combined metrics should include active counters"
    assert metrics["combined"]["html_refreshed"] == 4, "Combined metrics should include historical counters"
    assert metrics["combined"]["algorithm_successes"] == 2, "Combined metrics should include successes"
    assert metrics["combined"]["algorithm_misses"] == 1, "Combined metrics should include misses"
    assert metrics["combined"]["certificate_timeouts"] == 1, "Combined metrics should include certificate timeouts"
    assert "concurrency" in metrics, "Extraction metrics should record concurrency settings"
    assert "certificate_process_timeout_seconds" in metrics["concurrency"], "Extraction metrics should record certificate timeout"

    print("✓ Algorithm provenance and metrics test passed")


def test_fetch_policy_pdf_bytes_reuses_in_run_cache():
    """Local Security Policy PDF fetches should be reused within one scrape run."""
    class FakeResponse:
        status_code = 200
        headers = {}
        text = ""
        content = b"%PDF-1.7 fixture"

        def raise_for_status(self):
            return None

    class FakeClient:
        def __init__(self):
            self.calls = 0

        async def get(self, url):
            self.calls += 1
            await asyncio.sleep(0)
            return FakeResponse()

    async def scenario():
        client = FakeClient()
        pdf_cache = {}
        pdf_cache_lock = asyncio.Lock()
        first_bytes, first_hit = await fetch_policy_pdf_bytes(
            client,
            "https://csrc.nist.gov/example.pdf",
            pdf_cache,
            pdf_cache_lock,
        )
        second_bytes, second_hit = await fetch_policy_pdf_bytes(
            client,
            "https://csrc.nist.gov/example.pdf",
            pdf_cache,
            pdf_cache_lock,
        )
        return client.calls, first_bytes, first_hit, second_bytes, second_hit

    calls, first_bytes, first_hit, second_bytes, second_hit = asyncio.run(scenario())

    assert calls == 1, "Expected one network fetch for repeated policy URL"
    assert first_bytes == b"%PDF-1.7 fixture", "First PDF fetch returned unexpected bytes"
    assert second_bytes == first_bytes, "Second PDF fetch should reuse cached bytes"
    assert first_hit is False, "First PDF fetch should not be a cache hit"
    assert second_hit is True, "Second PDF fetch should be a cache hit"

    print("✓ Policy PDF cache reuse test passed")


def test_fetch_policy_pdf_bytes_shields_shared_cache_task_from_cancellation():
    """Cancelling one waiter should not cancel the shared PDF cache fetch task."""
    class FakeResponse:
        status_code = 200
        headers = {}
        text = ""
        content = b"%PDF-1.7 slow fixture"

        def raise_for_status(self):
            return None

    class FakeClient:
        def __init__(self):
            self.calls = 0

        async def get(self, url):
            self.calls += 1
            await asyncio.sleep(0.02)
            return FakeResponse()

    async def scenario():
        client = FakeClient()
        pdf_cache = {}
        pdf_cache_lock = asyncio.Lock()
        first_waiter = asyncio.create_task(
            fetch_policy_pdf_bytes(
                client,
                "https://csrc.nist.gov/slow.pdf",
                pdf_cache,
                pdf_cache_lock,
            )
        )
        await asyncio.sleep(0)
        first_waiter.cancel()
        try:
            await first_waiter
        except asyncio.CancelledError:
            pass

        cached_task = pdf_cache["https://csrc.nist.gov/slow.pdf"]
        was_cancelled = cached_task.cancelled()
        second_bytes, second_hit = await fetch_policy_pdf_bytes(
            client,
            "https://csrc.nist.gov/slow.pdf",
            pdf_cache,
            pdf_cache_lock,
        )
        return client.calls, was_cancelled, second_bytes, second_hit

    calls, was_cancelled, second_bytes, second_hit = asyncio.run(scenario())

    assert was_cancelled is False, "Shared PDF cache task should survive cancellation of one waiter"
    assert calls == 1, "Second PDF waiter should reuse the original cache task"
    assert second_bytes == b"%PDF-1.7 slow fixture", "Second waiter should receive bytes from the shared task"
    assert second_hit is True, "Second waiter should report a cache hit"

    print("✓ Policy PDF cache cancellation shielding test passed")


def test_fetch_with_retry_uses_jitter_and_four_attempts():
    """Async fetch retries should use four attempts and bounded jittered backoff."""
    url = "https://csrc.nist.gov/reset"
    request = scraper_module.httpx.Request("GET", url)
    sleeps = []
    jitter_calls = []

    class FakeClient:
        def __init__(self):
            self.calls = 0

        async def get(self, requested_url):
            assert requested_url == url, "fetch_with_retry should request the target URL"
            self.calls += 1
            raise scraper_module.httpx.RequestError("connection reset", request=request)

    async def fake_sleep(wait):
        sleeps.append(wait)

    def fake_uniform(start, end):
        jitter_calls.append((start, end))
        return 1.25

    original_sleep = scraper_module.asyncio.sleep
    original_uniform = scraper_module.random.uniform
    scraper_module.asyncio.sleep = fake_sleep
    scraper_module.random.uniform = fake_uniform
    try:
        client = FakeClient()
        result = asyncio.run(scraper_module.fetch_with_retry(client, url))
    finally:
        scraper_module.asyncio.sleep = original_sleep
        scraper_module.random.uniform = original_uniform

    assert result is None, "Exhausted retries should return None"
    assert client.calls == 4, "fetch_with_retry should default to four attempts"
    assert jitter_calls == [(0, 1.5), (0, 1.5), (0, 1.5)], "Each retry sleep should request jitter bounds"
    assert sleeps == [3.25, 5.25, 9.25], "Retry sleeps should include exponential backoff plus jitter"
    for attempt, wait in enumerate(sleeps):
        base = 2 ** (attempt + 1)
        assert 0 <= wait - base <= 1.5, "Retry jitter should stay within configured bounds"

    print("✓ Async retry jitter/backoff test passed")


def test_process_certificate_record_applies_cached_algorithm_provenance():
    """Cached algorithm reuse should still attach explicit provenance to outputs."""
    module = {
        "Certificate Number": "5238",
        "Vendor Name": "SUSE LLC",
        "Module Name": "SUSE Linux Enterprise OpenSSL 1 Cryptographic Module",
        "Module Type": "Software",
        "Validation Date": "04/10/2026",
        "security_policy_url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp5238.pdf",
        "certificate_detail_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5238",
    }
    previous_detail = {
        "certificate_number": "5238",
        "dataset": "active",
        "generated_at": "2026-04-01T00:00:00Z",
        "nist_page_url": module["certificate_detail_url"],
        "certificate_detail_url": module["certificate_detail_url"],
        "software_versions": "3.0.9",
        "hardware_versions": None,
        "firmware_versions": None,
        "security_policy_url": module["security_policy_url"],
        "vendor_name": "SUSE LLC",
        "module_name": "SUSE Linux Enterprise OpenSSL 1 Cryptographic Module",
        "standard": "FIPS 140-3",
        "status": "Active",
        "related_files": [],
        "validation_history": [],
        "vendor": {},
        "algorithms": ["AES", "HMAC"],
        "algorithms_detailed": ["AES-CBC A1", "HMAC SHA2-256 A1"],
        "algorithm_extraction": {
            "source": "crawl4ai",
            "source_url": module["security_policy_url"],
        },
    }
    previous_metadata = {
        "algorithm_source": "crawl4ai",
        "algorithm_cache_version": ALGORITHM_CACHE_VERSION,
    }

    module_out, detail_payload, categories, stats = asyncio.run(
        process_certificate_record(
            module,
            "active",
            "2026-04-12T03:10:00.961597Z",
            "crawl4ai",
            module,
            previous_detail,
            previous_metadata,
            None,
            asyncio.Semaphore(1),
            asyncio.Semaphore(1),
            {},
            asyncio.Lock(),
            {},
        )
    )

    assert categories == ["AES", "HMAC"], "Cached categories should be reused"
    assert module_out["algorithm_extraction"]["status"] == "cached", "Module should record cached extraction status"
    assert module_out["algorithm_extraction"]["source"] == "crawl4ai", "Cached source should be preserved"
    assert detail_payload["algorithm_extraction"]["cached"] is True, "Detail should record cache provenance"
    assert detail_payload["algorithm_extraction"]["algorithm_count"] == 2, "Detail algorithm count mismatch"
    assert stats["pdf_reused"] == 1, "Cached algorithm reuse should increment pdf_reused"
    assert stats["algorithm_cache_hits"] == 1, "Cached algorithm reuse should increment cache hits"

    print("✓ Cached algorithm provenance application test passed")


def test_process_certificate_record_timeout_preserves_cached_data():
    """Timed-out certificate work should preserve cached detail and algorithm payloads."""
    module = {
        "Certificate Number": "5238",
        "Vendor Name": "SUSE LLC",
        "Module Name": "SUSE Linux Enterprise OpenSSL 1 Cryptographic Module",
        "Module Type": "Software",
        "Validation Date": "04/10/2026",
        "security_policy_url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp5238.pdf",
        "certificate_detail_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5238",
    }
    previous_detail = {
        "certificate_number": "5238",
        "dataset": "active",
        "generated_at": "2026-04-01T00:00:00Z",
        "nist_page_url": module["certificate_detail_url"],
        "certificate_detail_url": module["certificate_detail_url"],
        "security_policy_url": module["security_policy_url"],
        "vendor_name": "SUSE LLC",
        "module_name": "SUSE Linux Enterprise OpenSSL 1 Cryptographic Module",
        "software_versions": "3.0.9",
        "hardware_versions": None,
        "firmware_versions": None,
        "algorithms": ["AES", "HMAC"],
        "algorithms_detailed": ["AES-CBC A1", "HMAC SHA2-256 A1"],
        "algorithm_extraction": {
            "source": "crawl4ai",
            "source_url": module["security_policy_url"],
        },
    }
    previous_metadata = {
        "algorithm_source": "crawl4ai",
        "algorithm_cache_version": ALGORITHM_CACHE_VERSION,
    }

    async def slow_process(*args, **kwargs):
        await asyncio.sleep(0.05)
        raise AssertionError("timeout wrapper should not wait for slow process to finish")

    original_process = scraper_module.process_certificate_record
    original_timeout = scraper_module.CERT_PROCESS_TIMEOUT
    scraper_module.process_certificate_record = slow_process
    scraper_module.CERT_PROCESS_TIMEOUT = 0.01
    try:
        index, module_out, detail_payload, categories, stats = asyncio.run(
            scraper_module.process_certificate_record_with_timeout(
                7,
                module,
                "active",
                "2026-04-12T03:10:00.961597Z",
                "crawl4ai",
                module,
                previous_detail,
                previous_metadata,
                None,
                asyncio.Semaphore(1),
                asyncio.Semaphore(1),
                {},
                asyncio.Lock(),
                {},
            )
        )
    finally:
        scraper_module.process_certificate_record = original_process
        scraper_module.CERT_PROCESS_TIMEOUT = original_timeout

    assert index == 7, "Timeout wrapper should preserve task index"
    assert categories == ["AES", "HMAC"], "Timeout fallback should preserve cached categories"
    assert module_out["detail_available"] is True, "Timeout fallback should preserve cached detail availability"
    assert module_out["algorithm_extraction"]["status"] == "cached", "Timeout fallback should mark cached algorithms"
    assert detail_payload["algorithm_extraction"]["attempts"][0]["status"] == "timeout", "Detail provenance should record timeout attempt"
    assert stats["certificate_timeouts"] == 0, "Recovered timeouts should not fail the quality gate"
    assert stats["html_reused"] == 1, "Timeout fallback should reuse cached detail"
    assert stats["algorithm_cache_hits"] == 1, "Timeout fallback should count cached algorithms"

    print("✓ Certificate timeout fallback test passed")


def test_process_certificate_record_preserves_cache_after_refresh_failure():
    """Transient detail or algorithm fetch failures should not replace valid cached data."""
    module = {
        "Certificate Number": "5238",
        "Vendor Name": "SUSE LLC",
        "Module Name": "SUSE Linux Enterprise OpenSSL 1 Cryptographic Module",
        "Module Type": "Software",
        "Validation Date": "04/11/2026",
        "security_policy_url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp5238.pdf",
        "certificate_detail_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5238",
    }
    previous_module = dict(module)
    previous_module["Validation Date"] = "04/10/2026"
    previous_detail = {
        "certificate_number": "5238",
        "dataset": "active",
        "generated_at": "2026-04-01T00:00:00Z",
        "nist_page_url": module["certificate_detail_url"],
        "certificate_detail_url": module["certificate_detail_url"],
        "security_policy_url": module["security_policy_url"],
        "vendor_name": "SUSE LLC",
        "module_name": "SUSE Linux Enterprise OpenSSL 1 Cryptographic Module",
        "standard": "FIPS 140-3",
        "status": "Active",
        "software_versions": "3.0.9",
        "hardware_versions": None,
        "firmware_versions": None,
        "related_files": [],
        "validation_history": [],
        "vendor": {},
        "algorithms": ["AES", "HMAC"],
        "algorithms_detailed": ["AES-CBC A1", "HMAC SHA2-256 A1"],
        "algorithm_extraction": {
            "source": "crawl4ai",
            "source_url": module["security_policy_url"],
        },
    }
    previous_metadata = {
        "algorithm_source": "crawl4ai",
        "algorithm_cache_version": ALGORITHM_CACHE_VERSION,
    }

    async def fetch_failure(*args, **kwargs):
        return None

    async def algorithm_failure(*args, **kwargs):
        return scraper_module.AlgorithmExtractionResult(
            detailed=[],
            categories=[],
            parsed=False,
            source="none",
            attempts=[{"source": "crawl4ai", "url": module["security_policy_url"], "status": "no_text"}],
        )

    original_fetch = scraper_module.fetch_with_retry
    original_algorithm_fetch = scraper_module.fetch_certificate_algorithms
    scraper_module.fetch_with_retry = fetch_failure
    scraper_module.fetch_certificate_algorithms = algorithm_failure
    try:
        module_out, detail_payload, categories, stats = asyncio.run(
            process_certificate_record(
                module,
                "active",
                "2026-04-12T03:10:00.961597Z",
                "crawl4ai",
                previous_module,
                previous_detail,
                previous_metadata,
                object(),
                asyncio.Semaphore(1),
                asyncio.Semaphore(1),
                {},
                asyncio.Lock(),
                {},
            )
        )
    finally:
        scraper_module.fetch_with_retry = original_fetch
        scraper_module.fetch_certificate_algorithms = original_algorithm_fetch

    assert module_out["detail_available"] is True, "Refresh failure should preserve cached detail"
    assert detail_payload["generated_at"] == "2026-04-12T03:10:00.961597Z", "Cached detail should be recontextualized"
    assert categories == ["AES", "HMAC"], "Algorithm failure should preserve cached categories"
    assert module_out["algorithm_extraction"]["status"] == "cached", "Fallback algorithms should be marked cached"
    assert detail_payload["algorithm_extraction"]["attempts"][0]["status"] == "no_text", "Failed extraction attempt should be retained on detail records"
    assert stats["html_reused"] == 1, "Cached detail fallback should count as reuse"
    assert stats["html_failed"] == 0, "Recovered refresh failures should not fail the quality gate"
    assert stats["algorithm_misses"] == 0, "Recovered algorithm failures should not fail the quality gate"
    assert stats["algorithm_cache_hits"] == 1, "Cached algorithm fallback should count cache hits"

    print("✓ Refresh failure cache preservation test passed")


def test_build_certificate_artifacts_defers_uncached_failures():
    """Uncached incomplete certificates should be retried later, not published as broken records."""
    modules = [
        {
            "Certificate Number": "6000",
            "Vendor Name": "Example Vendor",
            "Module Name": "Deferred Module",
            "Module Type": "Software",
            "Validation Date": "06/01/2026",
            "security_policy_url": "https://csrc.nist.gov/example/deferred.pdf",
            "certificate_detail_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/6000",
        },
        {
            "Certificate Number": "6001",
            "Vendor Name": "Example Vendor",
            "Module Name": "Complete Module",
            "Module Type": "Software",
            "Validation Date": "06/01/2026",
            "security_policy_url": "https://csrc.nist.gov/example/complete.pdf",
            "certificate_detail_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/6001",
        },
    ]

    async def fake_process(
        index,
        module,
        dataset,
        generated_at,
        algorithm_source,
        previous_module,
        previous_detail,
        previous_metadata,
        client,
        cert_semaphore,
        pdf_semaphore,
        pdf_cache,
        pdf_cache_lock,
        database_algorithms_map,
    ):
        if index == 0:
            module_out = dict(module)
            module_out[scraper_module.DEFERRED_REASON_KEY] = "certificate_detail_unavailable"
            module_out["detail_available"] = False
            return index, module_out, None, [], {"certificates_deferred": 1}

        module_out = dict(module)
        module_out["detail_available"] = True
        detail_payload = {
            "certificate_number": module["Certificate Number"],
            "dataset": dataset,
            "generated_at": generated_at,
            "nist_page_url": module["certificate_detail_url"],
            "certificate_detail_url": module["certificate_detail_url"],
            "security_policy_url": module["security_policy_url"],
            "vendor_name": module["Vendor Name"],
            "module_name": module["Module Name"],
            "standard": "FIPS 140-3",
            "status": "Active",
            "related_files": [],
            "validation_history": [],
            "vendor": {},
        }
        return index, module_out, detail_payload, ["AES"], {"html_refreshed": 1, "algorithm_successes": 1}

    original_process = scraper_module.process_certificate_record_with_timeout
    scraper_module.process_certificate_record_with_timeout = fake_process
    try:
        enriched, payloads, algorithms_map, stats, deferred = asyncio.run(
            build_certificate_artifacts(
                modules,
                "active",
                "2026-06-01T00:00:00.000000Z",
                "crawl4ai",
                {"metadata": {}, "modules": {"active": {}}, "details": {}},
                include_deferred=True,
            )
        )
    finally:
        scraper_module.process_certificate_record_with_timeout = original_process

    assert [record["Certificate Number"] for record in enriched] == ["6001"], "Deferred certificates should be omitted from published rows"
    assert set(payloads) == {6001}, "Deferred certificates should not get detail files"
    assert set(algorithms_map) == {6001}, "Deferred certificates should not get algorithm index entries"
    assert stats["certificates_deferred"] == 1, "Deferred certificates should be counted in metrics"
    assert stats["html_failed"] == 0, "Deferred records should not produce broken published artifacts"
    assert deferred == [
        {
            "certificate_number": "6000",
            "dataset": "active",
            "reason": "certificate_detail_unavailable",
        }
    ], "Deferred certificate metadata should be returned to callers"

    print("✓ Deferred certificate filtering test passed")


def test_build_shard_records_preserves_original_indices_after_deferral():
    """Published shard rows must keep their catalog indices when earlier certificates defer."""
    from modal_scrape_helpers import build_indexed_shard_records

    indexed_records = [
        (4, {"Certificate Number": "6000"}),
        (9, {"Certificate Number": "6001"}),
        (12, {"Certificate Number": "6002"}),
    ]
    processed_modules = [
        {"Certificate Number": "6001", "detail_available": True},
        {"Certificate Number": "6002", "detail_available": True},
    ]

    assert build_indexed_shard_records(indexed_records, processed_modules) == [
        {"index": 9, "module": processed_modules[0]},
        {"index": 12, "module": processed_modules[1]},
    ]


def test_compact_shard_modules_omits_deferred_catalog_slots():
    """Reducer output must omit empty slots left by deferred certificates."""
    from modal_scrape_helpers import compact_shard_modules

    module_6001 = {"Certificate Number": "6001"}
    module_6002 = {"Certificate Number": "6002"}

    assert compact_shard_modules([None, module_6001, None, module_6002]) == [
        module_6001,
        module_6002,
    ]


def test_save_sharded_changes_feed_preserves_history():
    """Sharded reduction must save a new changes feed using the previous run history."""
    from modal_scrape_helpers import save_sharded_changes_feed

    previous_changes = {
        "total_runs": 1,
        "runs": [{"generated_at": "2026-05-01T00:00:00Z"}],
    }
    previous_outputs = {"changes": previous_changes, "modules": {"active": {}, "historical": {}}}
    expected_feed = {
        "total_runs": 2,
        "runs": [
            {"generated_at": "2026-06-01T00:00:00Z"},
            previous_changes["runs"][0],
        ],
    }
    calls = {}

    class FakeScraper:
        @staticmethod
        def build_changes_feed(metadata, modules, historical_modules, supplied_outputs, supplied_changes):
            calls["build"] = (metadata, modules, historical_modules, supplied_outputs, supplied_changes)
            return expected_feed

        @staticmethod
        def save_json(payload, path):
            calls["save"] = (payload, path)

    metadata = {"generated_at": "2026-06-01T00:00:00Z"}
    modules = [{"Certificate Number": "6001"}]
    historical_modules = [{"Certificate Number": "5000"}]

    result = save_sharded_changes_feed(
        FakeScraper,
        metadata,
        modules,
        historical_modules,
        previous_outputs,
    )

    assert result is expected_feed
    assert calls["build"] == (
        metadata,
        modules,
        historical_modules,
        previous_outputs,
        previous_changes,
    )
    assert calls["save"] == (expected_feed, "api/changes.json")


def test_save_sharded_changes_feed_excludes_deferred_certificates_from_removals():
    """Temporary shard deferrals must not create permanent remove/add history."""
    from modal_scrape_helpers import save_sharded_changes_feed

    previous_outputs = {
        "modules": {
            "active": {
                6000: {"Certificate Number": "6000"},
                6002: {"Certificate Number": "6002"},
                6003: {"Certificate Number": "6003"},
            },
            "historical": {5000: {"Certificate Number": "5000"}},
        },
        "changes": None,
    }
    saved = {}

    class RecordingScraper:
        build_changes_feed = staticmethod(build_changes_feed)

        @staticmethod
        def save_json(payload, path):
            saved["payload"] = payload
            saved["path"] = path

    result = save_sharded_changes_feed(
        RecordingScraper,
        {"generated_at": "2026-06-01T00:00:00Z"},
        [{"Certificate Number": "6002"}],
        [],
        previous_outputs,
        deferred_certificates=[
            {"certificate_number": "6000", "dataset": "active", "reason": "temporary"},
            {"certificate_number": "5000", "dataset": "historical", "reason": "temporary"},
        ],
    )

    assert result["runs"][0]["removed"] == ["6003"]
    assert previous_outputs["modules"]["active"][6000]["Certificate Number"] == "6000"
    assert previous_outputs["modules"]["historical"][5000]["Certificate Number"] == "5000"
    assert saved == {"payload": result, "path": "api/changes.json"}


def test_sharded_deferred_baseline_survives_saved_output_reload():
    """Accepted compact output must retain the comparison row until recovery."""
    import scraper
    from modal_scrape_helpers import save_sharded_changes_feed

    with tempfile.TemporaryDirectory() as temp_dir:
        output_dir = Path(temp_dir)
        original = {"Certificate Number": "6000", "Module Name": "Original"}
        stable = {"Certificate Number": "6001"}
        scraper.save_json({"modules": [original, stable]}, str(output_dir / "modules.json"))
        previous = scraper.load_previous_outputs(output_dir)
        deferred = [{"certificate_number": "6000", "dataset": "active"}]
        feed = save_sharded_changes_feed(
            scraper, {"generated_at": "2026-06-01T00:00:00Z"}, [stable], [],
            previous, str(output_dir), deferred,
        )
        assert feed["runs"][0]["removed"] == []
        scraper.save_json({"modules": [stable]}, str(output_dir / "modules.json"))
        previous = scraper.load_previous_outputs(output_dir)
        recovered = save_sharded_changes_feed(
            scraper, {"generated_at": "2026-06-02T00:00:00Z"}, [original, stable], [],
            previous, str(output_dir),
        )
        assert recovered["runs"][0]["added_active"] == []
        assert recovered["runs"][0]["changed"] == []
        assert recovered["runs"][1] == feed["runs"][0]


def test_nonsharded_main_recovers_shared_sharded_baseline():
    """The normal entrypoint consumes and retires a sharded cache baseline."""
    from unittest.mock import patch
    from modal_scrape_helpers import save_sharded_changes_feed

    scraper = scraper_module
    original = {"Certificate Number": "6000", "Module Name": "Original"}
    stable = {"Certificate Number": "6001"}
    rows = [original, stable]
    with tempfile.TemporaryDirectory() as temp_dir:
        prior_cwd = os.getcwd()
        try:
            os.chdir(temp_dir)
            scraper.save_json({"modules": rows}, "api/modules.json")
            first = save_sharded_changes_feed(
                scraper, {"generated_at": "2026-06-01T00:00:00Z"}, [stable], [],
                scraper.load_previous_outputs(),
                deferred_certificates=[{"certificate_number": "6000", "dataset": "active"}],
            )
            scraper.save_json({"modules": [stable]}, "api/modules.json")
            # Stub only collection/enrichment boundaries; run main, the real loader,
            # change comparison and persistence against the same on-disk cache.
            empty = asyncio.run(scraper.build_certificate_artifacts(
                [], "active", "2026-06-02T00:00:00Z", "none", {},
                include_deferred=True,
            ))
            async def artifacts(modules, *args, **kwargs):
                return modules, {}, {}, empty[3], []

            with patch.multiple(scraper, FULL_REFRESH=False, SKIP_ALGORITHMS=True,
                                CMVP_DB_PATH=None, ALGORITHM_SOURCE_OVERRIDE="none"), \
                    patch.object(scraper, "scrape_all_modules", return_value=rows), \
                    patch.object(scraper, "scrape_historical_modules", return_value=[]), \
                    patch.object(scraper, "scrape_modules_in_process", return_value=[]), \
                    patch.object(scraper, "module_rows_with_cache_fallback",
                                 side_effect=lambda rows, *a, **kw: (rows, False)), \
                    patch.object(scraper, "enrich_modules_with_urls", side_effect=lambda value: value), \
                    patch.object(scraper, "build_certificate_artifacts", side_effect=artifacts):
                scraper.main()
            recovered = scraper.load_previous_outputs()
            assert recovered["changes"]["runs"][0]["added_active"] == []
            assert recovered["changes"]["runs"][0]["changed"] == []
            assert recovered["changes"]["runs"][1:] == first["runs"]
            assert recovered["changes_baseline"] == {"active": [], "historical": []}
        finally:
            os.chdir(prior_cwd)


def test_sharded_invocations_have_distinct_run_ids_with_frozen_clock():
    """Same-second invocations must not share catalogs or shard artifacts."""
    from datetime import datetime, timezone
    from unittest.mock import patch

    modal_scrape = load_modal_scrape_for_test()
    prepared_ids, shard_ids, reduced_ids = [], [], []

    def prepare(**kwargs):
        prepared_ids.append(kwargs["run_id"])
        return {}

    def shards(inputs, **kwargs):
        shard_ids.append({row[0] for row in inputs})
        return []

    def reduce(**kwargs):
        reduced_ids.append(kwargs["run_id"])
        return {"ok": True}

    clock = SimpleNamespace(now=lambda tz: datetime(2026, 9, 6, tzinfo=timezone.utc))
    with patch.multiple(
        modal_scrape, datetime=clock,
        prepare_sharded_run=SimpleNamespace(remote=prepare),
        process_certificate_shard=SimpleNamespace(starmap=shards),
        reduce_sharded_run=SimpleNamespace(remote=reduce),
    ):
        modal_scrape.sharded(shard_count=2)
        modal_scrape.sharded(shard_count=3)
    assert prepared_ids[0] != prepared_ids[1]
    assert reduced_ids == prepared_ids
    assert shard_ids == [{run_id} for run_id in prepared_ids]


def test_single_container_invocations_keep_distinct_artifacts_with_frozen_clock():
    """Same-second regular runs must retain their own log/artifact locations."""
    from datetime import datetime, timezone
    from unittest.mock import patch

    modal_scrape = load_modal_scrape_for_test()
    clock = SimpleNamespace(now=lambda tz: datetime(2026, 9, 6, tzinfo=timezone.utc))
    with tempfile.TemporaryDirectory() as temp_dir:
        with patch.multiple(
            modal_scrape, datetime=clock, WORKDIR=temp_dir, CACHE_DIR=temp_dir,
            _configure_scraper_environment=lambda **kw: None,
            _validate_generated_artifacts=lambda **kw: (0, "validated"),
            _archive_artifacts=lambda path: path.write_text("archive stand-in"),
        ), patch("subprocess.run", side_effect=[
            SimpleNamespace(returncode=0, stdout="first"),
            SimpleNamespace(returncode=0, stdout="second"),
        ]):
            first = modal_scrape.run_remote_scraper(use_cache_volume=False, update_cache_volume=False)
            second = modal_scrape.run_remote_scraper(use_cache_volume=False, update_cache_volume=False)
        assert first["run_id"] != second["run_id"]
        assert first["artifact"] != second["artifact"]
        assert first["logs"] != second["logs"]
        for result, expected in ((first, "first"), (second, "second")):
            assert result["ok"]
            assert (Path(temp_dir) / "runs" / result["run_id"] / "scraper.log").read_text() == expected


def test_sharded_deferred_baseline_lifecycle():
    """Repeated disk/cache reloads retain full rows, then retire only resolved rows."""
    import copy
    import scraper
    from modal_scrape_helpers import save_sharded_changes_feed

    modal_scrape = load_modal_scrape_for_test()
    for original_dataset in ("active", "historical"):
        for recovery in ("unchanged", "changed", "transition", "removed"):
            with tempfile.TemporaryDirectory() as temp_dir:
                output_dir = Path(temp_dir) / "api"
                output_dir.mkdir()
                original = {
                    "Certificate Number": "6000", "Module Name": "Original",
                    "Vendor Name": "Vendor", "Validation Date": "6/1/2026",
                    "algorithms": ["AES"], "algorithm_extraction": {"status": "cached"},
                }
                datasets = {"active": [], "historical": []}
                datasets[original_dataset] = [original]
                filenames = {"active": "modules.json", "historical": "historical-modules.json"}
                for dataset, filename in filenames.items():
                    scraper.save_json({"modules": datasets[dataset]}, str(output_dir / filename))
                previous = scraper.load_previous_outputs(output_dir)
                deferred = [{"certificate_number": "6000", "dataset": "historical"}]
                prior_cache = modal_scrape.CACHE_DIR
                modal_scrape.CACHE_DIR = str(Path(temp_dir) / "cache")
                try:
                    # Every accepted run persists compact catalogs, the sidecar, and
                    # the production Modal run snapshot (including JSON key conversion).
                    def run(active, historical, deferrals):
                        nonlocal previous
                        untouched = copy.deepcopy(previous)
                        feed = save_sharded_changes_feed(
                            scraper, {"generated_at": "2026-06-02T00:00:00Z"},
                            active, historical, previous, str(output_dir), deferrals,
                        )
                        assert previous == untouched
                        for dataset, rows in (("active", active), ("historical", historical)):
                            scraper.save_json({"modules": rows}, str(output_dir / filenames[dataset]))
                        previous = scraper.load_previous_outputs(output_dir)
                        modal_scrape._write_run_json("test", "previous_outputs.json", previous)
                        previous = modal_scrape._load_previous_outputs_for_run("test")
                        return feed

                    first = run([], [], deferred)
                    assert first["runs"][0]["removed"] == []
                    assert previous["changes_baseline"][original_dataset] == [original]
                    assert previous["modules"] == {"active": {}, "historical": {}}
                    newcomer = {"Certificate Number": "6001"}
                    second = run([newcomer], [], deferred)
                    assert second["runs"][0]["added_active"] == ["6001"]
                    assert second["runs"][0]["removed"] == []
                    assert previous["changes_baseline"][original_dataset] == [original]
                    rows = {"active": [], "historical": []}
                    target = original_dataset
                    if recovery == "transition":
                        target = "historical" if target == "active" else "active"
                    recovered_row = dict(original)
                    if recovery == "changed":
                        recovered_row["Module Name"] = "Revised"
                    if recovery != "removed":
                        rows[target] = [recovered_row]
                    # Even stale deferral evidence must not hide a published transition.
                    final = run(rows["active"], rows["historical"],
                                deferred if recovery == "transition" else [])
                    event = final["runs"][0]
                    assert event["removed"] == (["6000", "6001"] if recovery == "removed" else ["6001"])
                    assert event["changed"] == (["6000"] if recovery == "changed" else [])
                    for dataset in rows:
                        expected = ["6000"] if recovery == "transition" and dataset == target else []
                        assert event[f"added_{dataset}"] == expected
                    assert final["runs"][1:] == second["runs"]
                    assert final["total_runs"] == 3
                    assert previous["changes_baseline"] == {"active": [], "historical": []}
                    again = run(rows["active"], rows["historical"], [])
                    assert not any(again["runs"][0]["counts"].values())
                finally:
                    modal_scrape.CACHE_DIR = prior_cache


def load_modal_scrape_for_test():
    """Import modal_scrape with a minimal local stand-in for the optional Modal SDK."""
    import importlib
    import types

    class FakeApp:
        def __init__(self, _name):
            pass

        def function(self, *args, **kwargs):
            del args, kwargs
            return lambda function: function

        def local_entrypoint(self, *args, **kwargs):
            del args, kwargs
            return lambda function: function

    class FakeImageBuilder:
        def pip_install_from_requirements(self, *_args, **_kwargs):
            return self

        def add_local_dir(self, *_args, **_kwargs):
            return self

        def workdir(self, *_args, **_kwargs):
            return self

    fake_volume = SimpleNamespace(commit=lambda: None)
    fake_modal = types.ModuleType("modal")
    fake_modal.App = FakeApp
    fake_modal.Volume = SimpleNamespace(from_name=lambda *_args, **_kwargs: fake_volume)
    fake_modal.Image = SimpleNamespace(
        debian_slim=lambda *_args, **_kwargs: FakeImageBuilder()
    )

    previous_modal = sys.modules.get("modal")
    previous_modal_scrape = sys.modules.pop("modal_scrape", None)
    sys.modules["modal"] = fake_modal
    try:
        module = importlib.import_module("modal_scrape")
    finally:
        if previous_modal is None:
            sys.modules.pop("modal", None)
        else:
            sys.modules["modal"] = previous_modal
        if previous_modal_scrape is None:
            sys.modules.pop("modal_scrape", None)
        else:
            sys.modules["modal_scrape"] = previous_modal_scrape
    return module


def test_process_shard_persists_deferred_certificates():
    """Every shard artifact must retain details for certificates it omitted."""
    modal_scrape = load_modal_scrape_for_test()
    written = {}
    captured = {}
    deferred = [
        {
            "certificate_number": "6000",
            "dataset": "active",
            "reason": "certificate_detail_unavailable",
        }
    ]
    catalog = {
        "full_refresh": True,
        "algorithm_source": "crawl4ai",
        "skip_algorithms": False,
        "generated_at": "2026-06-01T00:00:00Z",
        "modules": [
            {"Certificate Number": "6000"},
            {"Certificate Number": "6001"},
        ],
        "historical_modules": [],
    }

    async def fake_build_certificate_artifacts(
        modules,
        dataset,
        generated_at,
        algorithm_source,
        previous_outputs,
        database_algorithms_map,
        include_deferred=False,
    ):
        del generated_at, algorithm_source, previous_outputs, database_algorithms_map
        captured["include_deferred"] = include_deferred
        processed = [dict(modules[1])]
        artifacts = (processed, {}, {}, {"certificates_deferred": 1})
        return (*artifacts, deferred) if include_deferred else artifacts

    fake_scraper = SimpleNamespace(
        FULL_REFRESH=False,
        CERT_FETCH_CONCURRENCY=0,
        PDF_FETCH_CONCURRENCY=0,
        CERT_PROCESS_TIMEOUT=0,
        build_certificate_artifacts=fake_build_certificate_artifacts,
    )
    previous_scraper = sys.modules.get("scraper")
    original_cwd = Path.cwd()
    with tempfile.TemporaryDirectory() as temp_dir:
        sys.modules["scraper"] = fake_scraper
        workdir = Path(temp_dir) / "workdir"
        workdir.mkdir()
        modal_scrape.WORKDIR = str(workdir)
        modal_scrape._load_run_json = lambda _run_id, _path: catalog
        modal_scrape._configure_scraper_environment = lambda **_kwargs: None
        modal_scrape._sync_cache_to_workdir = lambda **_kwargs: None
        modal_scrape._write_run_json = (
            lambda _run_id, path, payload: written.update({path: payload})
        )
        try:
            modal_scrape.process_certificate_shard("run", "active", 0, 1)
        finally:
            os.chdir(original_cwd)
            if previous_scraper is None:
                sys.modules.pop("scraper", None)
            else:
                sys.modules["scraper"] = previous_scraper

    shard = written["shards/active-0000.json"]
    assert captured["include_deferred"] is True
    assert shard["deferred_certificates"] == deferred
    assert shard["records"] == [
        {"index": 1, "module": {"Certificate Number": "6001"}}
    ]


def test_process_shard_loads_database_algorithm_map():
    """Database-backed shards must receive the configured certificate algorithm map."""
    modal_scrape = load_modal_scrape_for_test()
    captured = {}
    expected_map = {6000: ["AES Cert. #A1234"]}
    catalog = {
        "full_refresh": True,
        "algorithm_source": "database",
        "skip_algorithms": False,
        "generated_at": "2026-06-01T00:00:00Z",
        "modules": [{"Certificate Number": "6000"}],
        "historical_modules": [],
    }

    async def fake_build_certificate_artifacts(
        modules,
        dataset,
        generated_at,
        algorithm_source,
        previous_outputs,
        database_algorithms_map,
        include_deferred=False,
    ):
        del modules, dataset, generated_at, previous_outputs
        captured["algorithm_source"] = algorithm_source
        captured["database_algorithms_map"] = database_algorithms_map
        captured["include_deferred"] = include_deferred
        return ([{"Certificate Number": "6000"}], {}, expected_map, {}, [])

    def import_algorithms_from_database(path):
        captured["database_path"] = path
        return expected_map

    fake_scraper = SimpleNamespace(
        FULL_REFRESH=False,
        CERT_FETCH_CONCURRENCY=0,
        PDF_FETCH_CONCURRENCY=0,
        CERT_PROCESS_TIMEOUT=0,
        CMVP_DB_PATH="/workspace/data/cmvp.db",
        import_algorithms_from_database=import_algorithms_from_database,
        build_certificate_artifacts=fake_build_certificate_artifacts,
    )
    previous_scraper = sys.modules.get("scraper")
    original_cwd = Path.cwd()
    with tempfile.TemporaryDirectory() as temp_dir:
        sys.modules["scraper"] = fake_scraper
        workdir = Path(temp_dir) / "workdir"
        workdir.mkdir()
        modal_scrape.WORKDIR = str(workdir)
        modal_scrape._load_run_json = lambda _run_id, _path: catalog
        modal_scrape._configure_scraper_environment = lambda **_kwargs: None
        modal_scrape._sync_cache_to_workdir = lambda **_kwargs: None
        modal_scrape._write_run_json = lambda *_args, **_kwargs: None
        try:
            modal_scrape.process_certificate_shard("run", "active", 0, 1)
        finally:
            os.chdir(original_cwd)
            if previous_scraper is None:
                sys.modules.pop("scraper", None)
            else:
                sys.modules["scraper"] = previous_scraper

    assert captured == {
        "database_path": "/workspace/data/cmvp.db",
        "algorithm_source": "database",
        "database_algorithms_map": expected_map,
        "include_deferred": True,
    }


def test_sharded_reducer_reports_deferred_certificates():
    """The reduction quality report must receive deferred records from every shard."""
    import os

    modal_scrape = load_modal_scrape_for_test()
    deferred = [
        {
            "certificate_number": "6000",
            "dataset": "active",
            "reason": "certificate_detail_unavailable",
        }
    ]
    catalog = {
        "full_refresh": False,
        "algorithm_source": "crawl4ai",
        "skip_algorithms": False,
        "generated_at": "2026-06-01T00:00:00Z",
        "modules": [
            {"Certificate Number": "6000"},
            {"Certificate Number": "6001"},
        ],
        "historical_modules": [],
        "modules_in_process": [],
    }
    shards = {
        "shards/active-0000.json": {
            "records": [
                {"index": 1, "module": {"Certificate Number": "6001"}}
            ],
            "detail_payloads": {},
            "algorithms_map": {},
            "stats": {"certificates_deferred": 1},
            "deferred_certificates": deferred,
        },
        "shards/historical-0000.json": {
            "records": [],
            "detail_payloads": {},
            "algorithms_map": {},
            "stats": {},
            "deferred_certificates": [],
        },
    }
    captured = {}

    def build_data_quality_report(*args):
        captured["modules"] = args[1]
        captured["deferred"] = args[7] if len(args) > 7 else None
        return {
            "summary": {"deferred": len(captured["deferred"] or [])},
            "update_monitor": {"status": "pass", "checks": []},
        }

    def build_changes_feed_for_reducer(*args):
        captured["changes_previous_outputs"] = args[3]
        return {"runs": []}

    fake_scraper = SimpleNamespace(
        FULL_REFRESH=False,
        BASE_URL="https://example.invalid",
        MODULES_IN_PROCESS_URL="https://example.invalid/in-process",
        ALGORITHM_CACHE_VERSION="test",
        ALGORITHM_EXTRACTION_SCHEMA_VERSION="test",
        new_processing_stats=lambda: {},
        add_processing_stats=lambda target, stats: target.update(stats),
        build_extraction_metrics=lambda *_args: {"combined": {}},
        save_json=lambda *_args: None,
        parse_certificate_number=lambda module: int(module["Certificate Number"]),
        prune_orphan_certificate_details=lambda _numbers: 0,
        build_certificate_index_payload=lambda *_args: {},
        build_search_index_payloads=lambda *_args: {},
        build_data_quality_report=build_data_quality_report,
        build_changes_feed=build_changes_feed_for_reducer,
        build_examples_payload=lambda _metadata: {},
        build_index_payload=lambda *_args: {},
        generate_openapi_spec=lambda *_args: {},
        generate_text_artifacts=lambda *_args: {},
        save_text=lambda *_args: None,
        generate_json_schema_artifacts=lambda *_args: {},
    )

    with tempfile.TemporaryDirectory() as temp_dir:
        run_dir = Path(temp_dir) / "runs" / "run"
        run_dir.mkdir(parents=True)
        original_cwd = Path.cwd()
        previous_scraper = sys.modules.get("scraper")
        sys.modules["scraper"] = fake_scraper
        modal_scrape.WORKDIR = temp_dir
        modal_scrape.CACHE_DIR = str(Path(temp_dir) / "cache")
        modal_scrape._configure_scraper_environment = lambda **_kwargs: None
        modal_scrape._load_previous_outputs_for_run = lambda _run_id: {
            "modules": {
                "active": {6000: {"Certificate Number": "6000"}},
                "historical": {},
            },
            "details": {},
            "changes": {"total_runs": 1, "runs": []},
        }
        modal_scrape._load_run_json = (
            lambda _run_id, path: catalog if path == "catalog.json" else shards[path]
        )
        modal_scrape._artifact_paths_for_run = lambda _run_id: {
            "validate_log": run_dir / "validate.log",
            "artifact": run_dir / "artifacts.tar.gz",
        }
        modal_scrape._validate_generated_artifacts = (
            lambda **_kwargs: (0, "validation passed")
        )
        modal_scrape._archive_artifacts = lambda _path: None
        try:
            result = modal_scrape.reduce_sharded_run(
                "run",
                1,
                update_cache_volume=False,
            )
        finally:
            os.chdir(original_cwd)
            if previous_scraper is None:
                sys.modules.pop("scraper", None)
            else:
                sys.modules["scraper"] = previous_scraper

    assert result["ok"] is True
    assert captured["modules"] == [{"Certificate Number": "6001"}]
    assert captured["deferred"] == deferred
    assert captured["changes_previous_outputs"]["modules"]["active"] == {
        6000: {"Certificate Number": "6000"}
    }


def test_module_rows_with_cache_fallback_preserves_previous_top_level_list():
    """Top-level list outages should reuse checked-in rows instead of aborting updates."""
    previous_rows = [
        {
            "Certificate Number": "5238",
            "Vendor Name": "SUSE LLC",
            "Module Name": "SUSE Linux Enterprise OpenSSL 1 Cryptographic Module",
        },
        {
            "Certificate Number": "5237",
            "Vendor Name": "Example Vendor",
            "Module Name": "Example Module",
        },
    ]

    rows, used_fallback = module_rows_with_cache_fallback(
        [],
        previous_rows,
        "validated modules",
        min_expected=2,
    )

    assert used_fallback is True, "Empty scrape should use checked-in fallback rows"
    assert rows == previous_rows, "Fallback rows should preserve previous data"
    assert rows is not previous_rows, "Fallback rows should be copied before mutation"
    rows[0]["Vendor Name"] = "Mutated"
    assert previous_rows[0]["Vendor Name"] == "SUSE LLC", "Fallback should be a deep copy"

    scraped_rows = [{"Certificate Number": "6000"}, {"Certificate Number": "6001"}]
    rows, used_fallback = module_rows_with_cache_fallback(
        scraped_rows,
        previous_rows,
        "validated modules",
        min_expected=2,
    )
    assert used_fallback is False, "Complete scrape should not use fallback"
    assert rows is scraped_rows, "Complete scrape should preserve scraped row object"

    print("✓ Top-level module list fallback test passed")


def test_build_certificate_artifacts_bounds_active_tasks():
    """Certificate artifact scheduling should not start every module task at once."""
    modules = [
        {
            "Certificate Number": str(5200 + index),
            "Vendor Name": "Example Vendor",
            "Module Name": f"Example Module {index}",
            "Module Type": "Software",
            "Validation Date": "04/10/2026",
            "security_policy_url": f"https://csrc.nist.gov/example/{index}.pdf",
            "certificate_detail_url": f"https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/{5200 + index}",
        }
        for index in range(8)
    ]

    running = 0
    max_running = 0
    started = []

    async def fake_process(
        index,
        module,
        dataset,
        generated_at,
        algorithm_source,
        previous_module,
        previous_detail,
        previous_metadata,
        client,
        cert_semaphore,
        pdf_semaphore,
        pdf_cache,
        pdf_cache_lock,
        database_algorithms_map,
    ):
        nonlocal running, max_running
        running += 1
        max_running = max(max_running, running)
        started.append(index)
        try:
            await asyncio.sleep(0.01 * (len(modules) - index))
            module_out = dict(module)
            module_out["detail_available"] = True
            cert_number = module["Certificate Number"]
            detail_payload = {
                "certificate_number": cert_number,
                "dataset": dataset,
                "generated_at": generated_at,
                "nist_page_url": module["certificate_detail_url"],
                "certificate_detail_url": module["certificate_detail_url"],
                "security_policy_url": module["security_policy_url"],
                "vendor_name": module["Vendor Name"],
                "module_name": module["Module Name"],
                "standard": "FIPS 140-3",
                "status": "Active",
                "related_files": [],
                "validation_history": [],
                "vendor": {},
            }
            return index, module_out, detail_payload, ["AES"], {"html_refreshed": 1}
        finally:
            running -= 1

    original_process = scraper_module.process_certificate_record_with_timeout
    original_cert_concurrency = scraper_module.CERT_FETCH_CONCURRENCY
    original_pdf_concurrency = scraper_module.PDF_FETCH_CONCURRENCY
    scraper_module.process_certificate_record_with_timeout = fake_process
    scraper_module.CERT_FETCH_CONCURRENCY = 2
    scraper_module.PDF_FETCH_CONCURRENCY = 3
    try:
        enriched, payloads, algorithms_map, stats, deferred = asyncio.run(
            build_certificate_artifacts(
                modules,
                "active",
                "2026-04-12T03:10:00.961597Z",
                "crawl4ai",
                {"metadata": {}, "modules": {"active": {}}, "details": {}},
                include_deferred=True,
            )
        )
    finally:
        scraper_module.process_certificate_record_with_timeout = original_process
        scraper_module.CERT_FETCH_CONCURRENCY = original_cert_concurrency
        scraper_module.PDF_FETCH_CONCURRENCY = original_pdf_concurrency

    assert max_running <= 3, "Certificate scheduler should bound active tasks to the concurrency window"
    assert sorted(started) == list(range(len(modules))), "Every module should be scheduled once"
    assert [record["Certificate Number"] for record in enriched] == [module["Certificate Number"] for module in modules], "Output order should match input order"
    assert len(payloads) == len(modules), "Each fake detail payload should be retained"
    assert len(algorithms_map) == len(modules), "Each fake algorithm payload should be indexed"
    assert stats["html_refreshed"] == len(modules), "Stats should accumulate from bounded tasks"
    assert deferred == [], "Successful bounded tasks should not report deferrals"

    print("✓ Bounded certificate scheduling test passed")


def test_build_data_quality_report_marks_repeat_deferrals():
    """Deferred certificates should be marked when also deferred in the previous run."""
    metadata = {
        "generated_at": "2026-04-12T03:10:00.961597Z",
        "algorithm_source": "crawl4ai",
        "extraction_metrics": build_extraction_metrics({}, {}),
    }
    previous_outputs = {
        "metadata": {},
        "modules": {"active": {}, "historical": {}},
        "details": {},
        "deferred_certificates": [
            {
                "certificate_number": "6000",
                "dataset": "active",
                "reason": "certificate_detail_unavailable",
                "repeat": False,
            }
        ],
    }
    deferred = [
        {
            "certificate_number": "6000",
            "dataset": "active",
            "reason": "certificate_detail_unavailable",
        },
        {
            "certificate_number": "7000",
            "dataset": "historical",
            "reason": "algorithm_unavailable",
        },
    ]

    stderr = io.StringIO()
    original_stderr = sys.stderr
    sys.stderr = stderr
    try:
        report = build_data_quality_report(
            metadata,
            [],
            [],
            {},
            previous_outputs,
            {},
            {},
            deferred,
        )
    finally:
        sys.stderr = original_stderr

    assert report["summary"]["deferred"] == 2, "Deferred summary count should match deferred list"
    assert report["deferred_certificates"][0]["repeat"] is True, "Consecutive deferral should be marked repeat"
    assert report["deferred_certificates"][1]["repeat"] is False, "New deferral should not be marked repeat"
    assert (
        "Warning: certificate 6000 deferred in consecutive runs" in stderr.getvalue()
    ), "Repeat deferrals should emit a warning"

    print("✓ Repeat deferral marking test passed")


def test_build_data_quality_report_algorithm_coverage_buckets():
    """Algorithm coverage should classify every zero-algorithm certificate bucket."""
    metadata = {
        "generated_at": "2026-04-12T03:10:00.961597Z",
        "algorithm_source": "crawl4ai",
        "extraction_metrics": build_extraction_metrics({}, {}),
    }
    modules = [
        {
            "Certificate Number": "6100",
            "Vendor Name": "Example Vendor",
            "Module Name": "Covered Module",
            "algorithms": ["AES"],
            "detail_available": True,
        },
        {
            "Certificate Number": "6101",
            "Vendor Name": "Example Vendor",
            "Module Name": "Cached Empty Module",
            "algorithms": [],
            "detail_available": True,
            "algorithm_extraction": {
                "status": "cached",
                "source": "crawl4ai",
                "cached": True,
            },
        },
        {
            "Certificate Number": "6102",
            "Vendor Name": "Example Vendor",
            "Module Name": "Explicit Empty Module",
            "algorithms": [],
            "detail_available": True,
            "algorithm_extraction": {
                "status": "miss",
                "source": "security_policy_pdf",
                "cached": False,
                "attempts": [{"source": "security_policy_pdf", "status": "no_algorithms"}],
            },
        },
        {
            "Certificate Number": "6103",
            "Vendor Name": "Example Vendor",
            "Module Name": "Skipped Module",
            "algorithms": [],
            "detail_available": True,
            "algorithm_extraction": {
                "status": "skipped",
                "source": "none",
                "cached": False,
            },
        },
        {
            "Certificate Number": "6104",
            "Vendor Name": "Example Vendor",
            "Module Name": "Other Empty Module",
            "algorithms": [],
            "detail_available": True,
            "algorithm_extraction": {
                "status": "miss",
                "source": "crawl4ai",
                "cached": False,
                "attempts": [{"source": "crawl4ai", "status": "no_text"}],
            },
        },
    ]

    report = build_data_quality_report(
        metadata,
        modules,
        [],
        {},
        {"metadata": {}, "modules": {"active": {}}, "details": {}},
        {},
        {},
        [],
    )

    coverage = report["algorithm_coverage"]
    assert coverage["total_certificates"] == 5, "Coverage should count all active and historical certs"
    assert coverage["certificates_with_algorithms"] == 1, "Coverage should count certs with extracted algorithms"
    assert coverage["coverage_rate"] == 0.2, "Coverage rate should be rounded to four decimals"
    assert coverage["zero_algorithm_certificates"] == {
        "cached_no_attempts": 1,
        "explicit_no_algorithms": 1,
        "source_none": 1,
        "other": 1,
    }, "Zero-algorithm buckets should classify all empty algorithm records"

    print("✓ Algorithm coverage classification test passed")


def test_prune_orphan_certificate_details():
    """Test that stale certificate detail files are removed only for missing certs."""
    with tempfile.TemporaryDirectory() as temp_dir:
        detail_dir = Path(temp_dir)
        (detail_dir / "100.json").write_text("{}", encoding="utf-8")
        (detail_dir / "200.json").write_text("{}", encoding="utf-8")
        (detail_dir / "notes.json").write_text("{}", encoding="utf-8")

        removed = prune_orphan_certificate_details({100}, detail_dir)

        assert removed == 1, "Expected one orphaned certificate detail file to be removed"
        assert (detail_dir / "100.json").exists(), "Current certificate detail file should be preserved"
        assert not (detail_dir / "200.json").exists(), "Missing certificate detail file should be removed"
        assert (detail_dir / "notes.json").exists(), "Non-certificate files should be ignored"

    print("✓ Orphan certificate cleanup test passed")


def change_feed_module(cert_number, dataset="active", validation_date="04/10/2026"):
    """Build a minimal module row with stable fingerprint fields for change-feed tests."""
    status = "Active" if dataset == "active" else "Historical"
    return {
        "Certificate Number": str(cert_number),
        "Vendor Name": f"Vendor {cert_number}",
        "Module Name": f"Module {cert_number}",
        "Module Type": "Software",
        "Validation Date": validation_date,
        "standard": "FIPS 140-3",
        "status": status,
        "security_policy_url": (
            "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/"
            f"documents/security-policies/140sp{cert_number}.pdf"
        ),
        "certificate_detail_url": (
            "https://csrc.nist.gov/projects/cryptographic-module-validation-program/"
            f"certificate/{cert_number}"
        ),
        "detail_available": True,
    }


def test_build_changes_feed_first_run_empty_diffs():
    """First runs should not classify every existing certificate as newly added."""
    metadata = {"generated_at": "2026-04-12T03:10:00.961597Z", "version": "3.0"}
    feed = build_changes_feed(
        metadata,
        [change_feed_module(100)],
        [change_feed_module(200, "historical")],
        {"modules": {"active": {}, "historical": {}}},
        None,
    )

    assert feed["metadata"] == metadata, "Changes feed should embed shared metadata"
    assert feed["max_runs"] == 26, "Changes feed should retain 26 runs"
    assert feed["total_runs"] == 1, "First changes feed should report one run"
    assert len(feed["runs"]) == 1, "First changes feed should include the current run"
    entry = feed["runs"][0]
    assert entry["added_active"] == [], "First run should not mark active certificates as added"
    assert entry["added_historical"] == [], "First run should not mark historical certificates as added"
    assert entry["removed"] == [], "First run should not mark removals"
    assert entry["changed"] == [], "First run should not mark summary changes"
    assert entry["counts"] == {
        "added_active": 0,
        "added_historical": 0,
        "removed": 0,
        "changed": 0,
    }, "First run counts should be zeroed"

    print("✓ Changes feed first-run behavior test passed")


def test_build_changes_feed_appends_current_diff():
    """Changes feed should prepend the current diff and preserve prior entries."""
    metadata = {"generated_at": "2026-04-19T03:10:00.961597Z", "version": "3.0"}
    previous_active = change_feed_module(100, validation_date="04/09/2026")
    previous_historical = {
        200: change_feed_module(200, "historical"),
        300: change_feed_module(300, "historical"),
    }
    previous_changes = {
        "metadata": {"generated_at": "2026-04-12T03:10:00.961597Z"},
        "max_runs": 26,
        "total_runs": 1,
        "runs": [
            {
                "generated_at": "2026-04-12T03:10:00.961597Z",
                "added_active": [],
                "added_historical": [],
                "removed": [],
                "changed": [],
                "counts": {
                    "added_active": 0,
                    "added_historical": 0,
                    "removed": 0,
                    "changed": 0,
                },
            }
        ],
    }

    feed = build_changes_feed(
        metadata,
        [change_feed_module(100), change_feed_module(400)],
        [change_feed_module(300, "historical")],
        {
            "modules": {
                "active": {100: previous_active},
                "historical": previous_historical,
            }
        },
        previous_changes,
    )

    assert feed["total_runs"] == 2, "Appended feed should increment total run count"
    assert [entry["generated_at"] for entry in feed["runs"]] == [
        "2026-04-19T03:10:00.961597Z",
        "2026-04-12T03:10:00.961597Z",
    ], "Changes feed should be newest-first"
    entry = feed["runs"][0]
    assert entry["added_active"] == ["400"], "New active certificate should be listed"
    assert entry["added_historical"] == [], "No historical certificate was added"
    assert entry["removed"] == ["200"], "Removed historical certificate should be listed"
    assert entry["changed"] == ["100"], "Summary-changed active certificate should be listed"
    assert entry["counts"] == {
        "added_active": 1,
        "added_historical": 0,
        "removed": 1,
        "changed": 1,
    }, "Current run counts should match list lengths"

    print("✓ Changes feed append behavior test passed")


def test_build_changes_feed_caps_runs():
    """Changes feed should retain only the newest configured number of runs."""
    metadata = {"generated_at": "2026-07-01T00:00:00.000000Z", "version": "3.0"}
    previous_runs = [
        {
            "generated_at": f"2026-06-{day:02d}T00:00:00.000000Z",
            "added_active": [],
            "added_historical": [],
            "removed": [],
            "changed": [],
            "counts": {
                "added_active": 0,
                "added_historical": 0,
                "removed": 0,
                "changed": 0,
            },
        }
        for day in range(26, 0, -1)
    ]
    feed = build_changes_feed(
        metadata,
        [],
        [],
        {"modules": {"active": {}, "historical": {}}},
        {"max_runs": 26, "total_runs": 26, "runs": previous_runs},
    )

    assert feed["total_runs"] == 27, "Capped feed should preserve cumulative total runs"
    assert len(feed["runs"]) == 26, "Capped feed should keep only 26 entries"
    assert feed["runs"][0]["generated_at"] == metadata["generated_at"], "Current run should be newest"
    assert feed["runs"][-1]["generated_at"] == "2026-06-02T00:00:00.000000Z", "Oldest retained run mismatch"
    assert all(
        entry["generated_at"] != "2026-06-01T00:00:00.000000Z"
        for entry in feed["runs"]
    ), "Oldest previous run should be dropped"

    print("✓ Changes feed cap behavior test passed")


def test_validate_generated_api_artifacts():
    """Generated API artifacts built in a clean temp directory should pass validate_api."""
    generated_at = "2026-04-12T03:10:00.961597Z"
    active_extraction = {
        "schema_version": ALGORITHM_EXTRACTION_SCHEMA_VERSION,
        "status": "cached",
        "configured_source": "crawl4ai",
        "source": "crawl4ai",
        "source_url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp9901.pdf",
        "cached": True,
        "fallback_used": False,
        "cache_version": ALGORITHM_CACHE_VERSION,
        "algorithm_count": 2,
        "detailed_algorithm_count": 0,
    }
    historical_extraction = {
        "schema_version": ALGORITHM_EXTRACTION_SCHEMA_VERSION,
        "status": "cached",
        "configured_source": "crawl4ai",
        "source": "crawl4ai",
        "source_url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp9902.pdf",
        "cached": True,
        "fallback_used": False,
        "cache_version": ALGORITHM_CACHE_VERSION,
        "algorithm_count": 1,
        "detailed_algorithm_count": 0,
    }
    active_module = {
        "Certificate Number": "9901",
        "Vendor Name": "Example Vendor",
        "Module Name": "Example Active Module",
        "Module Type": "Software",
        "Validation Date": "04/10/2026",
        "standard": "FIPS 140-3",
        "status": "Active",
        "overall_level": 1,
        "sunset_date": "4/9/2031",
        "security_policy_url": active_extraction["source_url"],
        "certificate_detail_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/9901",
        "detail_available": True,
        "algorithms": ["AES", "HMAC"],
        "algorithm_extraction": dict(active_extraction),
    }
    historical_module = {
        "Certificate Number": "9902",
        "Vendor Name": "Legacy Vendor",
        "Module Name": "Example Historical Module",
        "Module Type": "Hardware",
        "Validation Date": "01/02/2014",
        "standard": "FIPS 140-2",
        "status": "Historical",
        "security_policy_url": historical_extraction["source_url"],
        "certificate_detail_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/9902",
        "detail_available": True,
        "algorithms": ["AES"],
        "algorithm_extraction": dict(historical_extraction),
    }
    in_process_module = {
        "Module Name": "Example Pending Module",
        "Vendor Name": "Pending Vendor",
        "Standard": "FIPS 140-3",
        "Status": "In Review",
    }
    detail_payloads = {
        9901: {
            "certificate_number": "9901",
            "dataset": "active",
            "generated_at": generated_at,
            "nist_page_url": active_module["certificate_detail_url"],
            "certificate_detail_url": active_module["certificate_detail_url"],
            "security_policy_url": active_module["security_policy_url"],
            "vendor_name": "Example Vendor",
            "module_name": "Example Active Module",
            "standard": "FIPS 140-3",
            "status": "Active",
            "module_type": "Software",
            "overall_level": 1,
            "validation_dates": ["4/10/2026"],
            "sunset_date": "4/9/2031",
            "vendor": {"name": "Example Vendor"},
            "related_files": [
                {"label": "Security Policy", "url": active_module["security_policy_url"]}
            ],
            "validation_history": [
                {"date": "4/10/2026", "type": "Initial", "lab": "Example Lab"}
            ],
            "software_versions": "1.0",
            "hardware_versions": None,
            "firmware_versions": None,
            "algorithms": ["AES", "HMAC"],
            "algorithm_extraction": dict(active_extraction),
        },
        9902: {
            "certificate_number": "9902",
            "dataset": "historical",
            "generated_at": generated_at,
            "nist_page_url": historical_module["certificate_detail_url"],
            "certificate_detail_url": historical_module["certificate_detail_url"],
            "security_policy_url": historical_module["security_policy_url"],
            "vendor_name": "Legacy Vendor",
            "module_name": "Example Historical Module",
            "standard": "FIPS 140-2",
            "status": "Historical",
            "module_type": "Hardware",
            "validation_dates": ["1/2/2014"],
            "vendor": {"name": "Legacy Vendor"},
            "related_files": [
                {"label": "Security Policy", "url": historical_module["security_policy_url"]}
            ],
            "validation_history": [
                {"date": "1/2/2014", "type": "Initial", "lab": "Example Lab"}
            ],
            "software_versions": None,
            "hardware_versions": "1.0",
            "firmware_versions": None,
            "algorithms": ["AES"],
            "algorithm_extraction": dict(historical_extraction),
        },
    }
    active_stats = {"html_reused": 1, "pdf_reused": 1, "algorithm_cache_hits": 1, "algorithm_successes": 1}
    historical_stats = {"html_reused": 9, "pdf_reused": 9, "algorithm_cache_hits": 9, "algorithm_successes": 9}
    extraction_metrics = build_extraction_metrics(active_stats, historical_stats)
    algorithms_map = {9901: ["AES", "HMAC"], 9902: ["AES"]}
    metadata = {
        "generated_at": generated_at,
        "total_modules": 1,
        "total_historical_modules": 1,
        "total_modules_in_process": 1,
        "total_certificates_with_algorithms": 2,
        "total_certificate_details": 2,
        "source": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/validated-modules/search",
        "modules_in_process_source": "https://csrc.nist.gov/Projects/cryptographic-module-validation-program/modules-in-process/modules-in-process-list",
        "algorithm_source": "crawl4ai",
        "algorithm_cache_version": ALGORITHM_CACHE_VERSION,
        "algorithm_extraction_schema_version": ALGORITHM_EXTRACTION_SCHEMA_VERSION,
        "extraction_metrics": extraction_metrics,
        "version": "3.0",
    }
    previous_outputs = {
        "metadata": {"generated_at": "2026-04-11T00:00:00.000000Z"},
        "modules": {
            "active": {9901: dict(active_module)},
            "historical": {9902: dict(historical_module)},
        },
        "details": detail_payloads,
        "changes": None,
    }

    def write_json(root: Path, rel_path: str, payload: dict) -> None:
        target = root / rel_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    def write_text(root: Path, rel_path: str, content: str) -> None:
        target = root / rel_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_root = Path(temp_dir)
        write_text(temp_root, "README.md", (Path(__file__).parent / "README.md").read_text(encoding="utf-8"))
        write_json(temp_root, "api/metadata.json", metadata)
        write_json(temp_root, "api/modules.json", {"metadata": metadata, "modules": [active_module]})
        write_json(temp_root, "api/historical-modules.json", {"metadata": metadata, "modules": [historical_module]})
        write_json(
            temp_root,
            "api/modules-in-process.json",
            {"metadata": metadata, "modules_in_process": [in_process_module]},
        )
        for cert_number, payload in detail_payloads.items():
            write_json(
                temp_root,
                f"api/certificates/{cert_number}.json",
                {
                    "metadata": {
                        "generated_at": generated_at,
                        "dataset": payload["dataset"],
                        "source": payload["nist_page_url"],
                    },
                    "certificate": payload,
                },
            )

        certificate_index = build_certificate_index_payload(
            metadata, [active_module], [historical_module], detail_payloads
        )
        write_json(temp_root, "api/certificates/index.json", certificate_index)
        for rel_path, index_payload in build_search_index_payloads(metadata, certificate_index).items():
            write_json(temp_root, rel_path, index_payload)

        data_quality = build_data_quality_report(
            metadata,
            [active_module],
            [historical_module],
            detail_payloads,
            previous_outputs,
            active_stats,
            historical_stats,
            [],
        )
        write_json(temp_root, "api/data-quality.json", data_quality)
        changes_feed = build_changes_feed(metadata, [active_module], [historical_module], previous_outputs, None)
        write_json(temp_root, "api/changes.json", changes_feed)
        write_json(temp_root, "api/examples.json", build_examples_payload(metadata))

        algorithms_summary = create_algorithms_summary(algorithms_map)
        algorithms_summary["metadata"] = {
            "generated_at": generated_at,
            "total_certificates_processed": len(algorithms_map),
            "source": "crawl4ai",
            "algorithm_source": "crawl4ai",
            "algorithm_cache_version": ALGORITHM_CACHE_VERSION,
            "algorithm_extraction_schema_version": ALGORITHM_EXTRACTION_SCHEMA_VERSION,
            "extraction_metrics": extraction_metrics["combined"],
        }
        write_json(temp_root, "api/algorithms.json", algorithms_summary)
        write_json(temp_root, "api/index.json", build_index_payload(metadata, algorithms_summary))
        write_json(
            temp_root,
            "openapi.json",
            generate_openapi_spec([active_module], metadata, detail_payloads[9901], algorithms_summary),
        )
        for rel_path, content in generate_text_artifacts(
            metadata, active_module, detail_payloads[9901], algorithms_summary
        ).items():
            write_text(temp_root, rel_path, content)
        for rel_path, schema in generate_json_schema_artifacts(algorithms_summary).items():
            write_json(temp_root, rel_path, schema)

        errors = validate_api(
            temp_root,
            require_current_schema=True,
            require_supported_algorithm_source=True,
            require_data_quality_pass=True,
        )
        assert errors == [], "Generated API artifact validation failed:\n" + "\n".join(errors[:20])

        (temp_root / "api" / "certificates" / "9902.json").unlink()
        missing_errors = validate_api(temp_root, require_current_schema=True)
        assert any("missing detail files" in err for err in missing_errors), (
            "Expected missing detail file error when a certificate detail JSON is removed"
        )

    print("✓ Generated API artifact validation test passed")


def test_build_certificate_index_payload():
    """Certificate index should expose stable paths and compact lookup rows."""
    metadata = {
        "generated_at": "2026-04-12T03:10:00.961597Z",
        "total_modules": 1,
        "total_historical_modules": 1,
        "total_modules_in_process": 0,
        "total_certificates_with_algorithms": 1,
        "total_certificate_details": 2,
        "source": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/validated-modules/search",
        "modules_in_process_source": "https://csrc.nist.gov/Projects/cryptographic-module-validation-program/modules-in-process/modules-in-process-list",
        "algorithm_source": "crawl4ai",
        "algorithm_cache_version": ALGORITHM_CACHE_VERSION,
        "algorithm_extraction_schema_version": ALGORITHM_EXTRACTION_SCHEMA_VERSION,
        "version": "3.0",
    }
    active_module = {
        "Certificate Number": "5238",
        "Vendor Name": "SUSE LLC",
        "Module Name": "SUSE Linux Enterprise OpenSSL 1 Cryptographic Module",
        "Module Type": "Software",
        "Validation Date": "04/10/2026",
        "standard": "FIPS 140-3",
        "status": "Active",
        "overall_level": 1,
        "sunset_date": "4/9/2031",
        "security_policy_url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp5238.pdf",
        "certificate_detail_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5238",
        "detail_available": True,
    }
    historical_module = {
        "Certificate Number": "1400",
        "Vendor Name": "Example Corp.",
        "Module Name": "Example Legacy Module",
        "Module Type": "Hardware",
        "Validation Date": "01/02/2014",
        "standard": "FIPS 140-2",
        "status": "Historical",
        "security_policy_url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp1400.pdf",
        "certificate_detail_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/1400",
        "algorithms": ["AES"],
        "detail_available": True,
    }
    detail_payloads = {
        5238: {
            "certificate_number": "5238",
            "dataset": "active",
            "vendor_name": "SUSE LLC",
            "module_name": "SUSE Linux Enterprise OpenSSL 1 Cryptographic Module",
            "standard": "FIPS 140-3",
            "status": "Active",
            "module_type": "Software",
            "overall_level": 1,
            "validation_dates": ["4/10/2026"],
            "sunset_date": "4/9/2031",
            "nist_page_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5238",
            "certificate_detail_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5238",
            "security_policy_url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp5238.pdf",
            "algorithms": ["AES", "HMAC", "RSA"],
            "algorithm_extraction": {
                "status": "parsed",
                "source": "crawl4ai",
            },
        }
    }

    payload = build_certificate_index_payload(
        metadata,
        [active_module],
        [historical_module],
        detail_payloads,
    )

    assert payload["metadata"] == metadata, "Certificate index should embed shared metadata"
    assert payload["total_certificates"] == 2, "Certificate index count mismatch"
    assert payload["certificate_paths"]["5238"] == "/api/certificates/5238.json", "Certificate path lookup mismatch"
    assert [entry["certificate_number"] for entry in payload["certificates"]] == ["1400", "5238"], "Certificate index should sort numerically"

    active_entry = payload["certificates"][1]
    assert active_entry["dataset"] == "active", "Active entry dataset mismatch"
    assert active_entry["algorithm_count"] == 3, "Active entry algorithm_count mismatch"
    assert active_entry["algorithm_extraction_status"] == "parsed", "Active entry extraction status mismatch"
    assert active_entry["algorithm_source"] == "crawl4ai", "Active entry extraction source mismatch"

    historical_entry = payload["certificates"][0]
    assert historical_entry["dataset"] == "historical", "Historical entry dataset mismatch"
    assert historical_entry["algorithms"] == ["AES"], "Historical entry should fall back to module algorithms"
    assert historical_entry["path"] == "/api/certificates/1400.json", "Historical entry path mismatch"

    print("✓ Certificate index payload test passed")


def test_data_quality_search_indexes_and_examples():
    """Quality report, split indexes, and examples should expose common consumer workflows."""
    metadata = {
        "generated_at": "2026-04-12T03:10:00.961597Z",
        "total_modules": 1,
        "total_historical_modules": 1,
        "total_modules_in_process": 0,
        "total_certificates_with_algorithms": 1,
        "total_certificate_details": 2,
        "source": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/validated-modules/search",
        "modules_in_process_source": "https://csrc.nist.gov/Projects/cryptographic-module-validation-program/modules-in-process/modules-in-process-list",
        "algorithm_source": "crawl4ai",
        "algorithm_cache_version": ALGORITHM_CACHE_VERSION,
        "algorithm_extraction_schema_version": ALGORITHM_EXTRACTION_SCHEMA_VERSION,
        "extraction_metrics": build_extraction_metrics(
            {"html_reused": 8, "html_refreshed": 1, "algorithm_successes": 9},
            {"html_reused": 10, "algorithm_successes": 9, "algorithm_misses": 1},
        ),
        "version": "3.0",
    }
    active_module = {
        "Certificate Number": "5238",
        "Vendor Name": "SUSE LLC",
        "Module Name": "SUSE Linux Enterprise OpenSSL 1 Cryptographic Module",
        "Module Type": "Software",
        "Validation Date": "04/10/2026",
        "standard": "FIPS 140-3",
        "status": "Active",
        "security_policy_url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp5238.pdf",
        "certificate_detail_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5238",
        "algorithms": ["AES", "HMAC"],
        "detail_available": True,
    }
    historical_module = {
        "Certificate Number": "1400",
        "Vendor Name": "Example Corp.",
        "Module Name": "Example Legacy Module",
        "Module Type": "Hardware",
        "Validation Date": "01/02/2014",
        "standard": "FIPS 140-2",
        "status": "Historical",
        "security_policy_url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp1400.pdf",
        "certificate_detail_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/1400",
        "algorithms": [],
        "detail_available": True,
        "algorithm_extraction": {
            "status": "miss",
            "source": "security_policy_pdf",
            "source_url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp1400.pdf",
            "fallback_used": False,
        },
    }
    detail_payloads = {
        5238: {
            "certificate_number": "5238",
            "dataset": "active",
            "vendor_name": "SUSE LLC",
            "module_name": "SUSE Linux Enterprise OpenSSL 1 Cryptographic Module",
            "standard": "FIPS 140-3",
            "status": "Active",
            "module_type": "Software",
            "validation_dates": ["4/10/2026"],
            "nist_page_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5238",
            "certificate_detail_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5238",
            "security_policy_url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp5238.pdf",
            "related_files": [],
            "validation_history": [],
            "vendor": {},
            "algorithms": ["AES", "HMAC"],
            "algorithm_extraction": {
                "status": "parsed",
                "source": "security_policy_pdf",
                "source_url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp5238.pdf",
                "fallback_used": True,
                "attempts": [
                    {"source": "crawl4ai", "status": "no_algorithms"},
                    {"source": "security_policy_pdf", "status": "parsed"},
                ],
            },
        }
    }
    previous_active = dict(active_module)
    previous_active["Validation Date"] = "04/09/2026"
    previous_outputs = {
        "metadata": metadata,
        "modules": {
            "active": {5238: previous_active},
            "historical": {1400: historical_module},
        },
        "details": {5238: detail_payloads[5238]},
    }

    certificate_index = build_certificate_index_payload(metadata, [active_module], [historical_module], detail_payloads)
    search_indexes = build_search_index_payloads(metadata, certificate_index)
    vendor_index = search_indexes["api/indexes/vendors.json"]
    algorithm_index = search_indexes["api/indexes/algorithms.json"]
    status_index = search_indexes["api/indexes/statuses.json"]
    standard_index = search_indexes["api/indexes/standards.json"]

    assert vendor_index["keys"]["SUSE LLC"][0]["certificate_number"] == "5238", "Vendor index should point to active cert"
    assert [entry["certificate_number"] for entry in algorithm_index["keys"]["AES"]] == ["5238"], "Algorithm index should include AES cert"
    assert status_index["keys"]["Active"][0]["path"] == "/api/certificates/5238.json", "Status index should expose cert paths"
    assert standard_index["keys"]["FIPS 140-2"][0]["certificate_number"] == "1400", "Standard index should include historical cert"

    report = build_data_quality_report(
        metadata,
        [active_module],
        [historical_module],
        detail_payloads,
        previous_outputs,
        {"html_reused": 8, "html_refreshed": 1, "algorithm_successes": 9},
        {"html_reused": 10, "algorithm_successes": 9, "algorithm_misses": 1},
    )

    assert report["summary"]["refreshed_records"] == 1, "Changed active cert should be listed as refreshed"
    assert report["summary"]["changed_certificates"] == 1, "Summary change should be listed as changed certificate"
    assert report["summary"]["fallback_usage"] == 1, "Fallback extraction should be listed"
    assert report["summary"]["misses"] == 1, "Historical algorithm miss should be listed"
    assert report["summary"]["deferred"] == 0, "No deferred certificates should be reported for this fixture"
    assert report["deferred_certificates"] == [], "Deferred certificate list should be present and empty"
    assert report["algorithm_coverage"] == {
        "total_certificates": 2,
        "certificates_with_algorithms": 1,
        "coverage_rate": 0.5,
        "zero_algorithm_certificates": {
            "cached_no_attempts": 0,
            "explicit_no_algorithms": 0,
            "source_none": 0,
            "other": 1,
        },
    }, "Algorithm coverage should summarize zero-algorithm certificates"
    assert report["update_monitor"]["next_scheduled_run"] == "2026-04-19T02:00:00Z", "Next weekly run should be Sunday 02:00 UTC"
    checks = {
        check["name"]: check
        for check in report["update_monitor"]["checks"]
    }
    assert checks["algorithm_misses"]["status"] == "warn", "Algorithm misses should trip the run-health monitor"
    assert report["update_monitor"]["status"] == "warn", "Any warning check should make the monitor warn"

    examples = build_examples_payload(metadata)
    assert {"curl", "python", "javascript", "agent"} <= set(examples["examples"]), "Examples should cover every consumer family"
    assert "indexes/vendors.json" in examples["examples"]["curl"][0]["command"], "curl examples should use split indexes"
    assert any("module_name" in step.lower() for step in examples["examples"]["agent"][1]["steps"]), "Agent examples should include module lookup"

    print("✓ Data quality, search index, and examples test passed")


def test_generate_agent_docs():
    """Test the generated agent-friendly documentation artifacts."""
    metadata = {
        "generated_at": "2026-04-12T03:10:00.961597Z",
        "total_modules": 1086,
        "total_historical_modules": 4141,
        "total_modules_in_process": 331,
        "total_certificates_with_algorithms": 374,
        "total_certificate_details": 5227,
        "source": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/validated-modules/search",
        "modules_in_process_source": "https://csrc.nist.gov/Projects/cryptographic-module-validation-program/modules-in-process/modules-in-process-list",
        "algorithm_source": "crawl4ai",
        "algorithm_cache_version": ALGORITHM_CACHE_VERSION,
        "algorithm_extraction_schema_version": ALGORITHM_EXTRACTION_SCHEMA_VERSION,
        "extraction_metrics": build_extraction_metrics(
            {"html_reused": 1, "pdf_reused": 1, "algorithm_cache_hits": 1},
            {"html_refreshed": 1, "pdf_refreshed": 1, "algorithm_successes": 1},
        ),
        "version": "3.0",
    }
    sample_module = {
        "Certificate Number": "5238",
        "Vendor Name": "SUSE LLC",
        "Module Name": "SUSE Linux Enterprise OpenSSL 1 Cryptographic Module",
        "Module Type": "Software",
        "Validation Date": "04/10/2026",
        "standard": "FIPS 140-3",
        "status": "Active",
        "overall_level": 1,
        "sunset_date": "4/9/2031",
        "algorithms": ["AES", "HMAC", "RSA"],
        "security_policy_url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp5238.pdf",
        "certificate_detail_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5238",
        "detail_available": True,
        "description": "OpenSSL is an open-source library of various cryptographic algorithms written mainly in C.",
        "algorithm_extraction": {
            "schema_version": ALGORITHM_EXTRACTION_SCHEMA_VERSION,
            "status": "cached",
            "configured_source": "crawl4ai",
            "source": "crawl4ai",
            "source_url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp5238.pdf",
            "cached": True,
            "fallback_used": False,
            "cache_version": ALGORITHM_CACHE_VERSION,
            "algorithm_count": 3,
            "detailed_algorithm_count": 0,
        },
    }
    sample_detail = {
        "certificate_number": "5238",
        "dataset": "active",
        "generated_at": metadata["generated_at"],
        "nist_page_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5238",
        "certificate_detail_url": "https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5238",
        "security_policy_url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp5238.pdf",
        "vendor_name": "SUSE LLC",
        "module_name": "SUSE Linux Enterprise OpenSSL 1 Cryptographic Module",
        "standard": "FIPS 140-3",
        "status": "Active",
        "module_type": "Software",
        "overall_level": 1,
        "validation_dates": ["4/10/2026"],
        "sunset_date": "4/9/2031",
        "caveat": "When operated in approved mode and installed as described in the Security Policy.",
        "security_level_exceptions": ["Physical security: N/A"],
        "vendor": {
            "name": "SUSE LLC",
            "website_url": "https://www.suse.com/",
            "contact_email": "security@suse.com",
        },
        "related_files": [
            {
                "label": "Security Policy",
                "url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp5238.pdf",
            }
        ],
        "validation_history": [
            {"date": "4/10/2026", "type": "Initial", "lab": "Example Lab"}
        ],
        "algorithms": ["AES", "HMAC", "RSA"],
        "algorithm_extraction": {
            "schema_version": ALGORITHM_EXTRACTION_SCHEMA_VERSION,
            "status": "parsed",
            "configured_source": "crawl4ai",
            "source": "crawl4ai",
            "source_url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp5238.pdf",
            "cached": False,
            "fallback_used": False,
            "cache_version": ALGORITHM_CACHE_VERSION,
            "algorithm_count": 3,
            "detailed_algorithm_count": 12,
            "attempts": [
                {
                    "source": "crawl4ai",
                    "url": "https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp5238.pdf",
                    "status": "parsed",
                }
            ],
        },
    }
    algorithms_summary = {
        "total_unique_algorithms": 45,
        "total_certificate_algorithm_pairs": 8500,
        "algorithms": {
            "AES": {
                "count": 950,
                "certificates": [5238, 5237, 5236],
            }
        },
    }

    artifacts = generate_text_artifacts(
        metadata,
        sample_module,
        sample_detail,
        algorithms_summary,
    )
    assert "llms-full.txt" in artifacts, "Missing llms-full.txt artifact"
    assert "api/docs.md" in artifacts, "Missing Markdown API docs artifact"
    assert "api/algorithms.json" in artifacts["llms.txt"], "llms.txt should reference algorithms endpoint when available"
    assert "api/certificates/index.json" in artifacts["llms.txt"], "llms.txt should reference certificate index endpoint"
    assert "api/data-quality.json" in artifacts["llms.txt"], "llms.txt should reference data quality endpoint"
    assert "api/changes.json" in artifacts["llms.txt"], "llms.txt should reference changes endpoint"
    assert "api/examples.json" in artifacts["llms.txt"], "llms.txt should reference examples endpoint"
    assert "api/indexes/vendors.json" in artifacts["llms.txt"], "llms.txt should reference split search indexes"
    assert 'href="api/docs.md"' in artifacts["index.html"], "Homepage should link to api/docs.md"
    assert 'href="api/schemas/index.schema.json"' in artifacts["index.html"], "Homepage should link to JSON schemas"
    assert 'href="api/certificates/index.json"' in artifacts["index.html"], "Homepage should link to certificate index"
    assert 'href="api/data-quality.json"' in artifacts["index.html"], "Homepage should link to data quality"
    assert 'href="api/indexes/vendors.json"' in artifacts["index.html"], "Homepage should link to vendor index"
    assert "GET api/certificates/index.json" in artifacts["api/docs.md"], "API docs should include certificate index endpoint"
    assert "GET api/certificates/{certificate}.json" in artifacts["api/docs.md"], "API docs should include certificate detail endpoint"
    assert "GET api/schemas/index.schema.json" in artifacts["api/docs.md"], "API docs should include JSON schema endpoint"
    assert "GET api/data-quality.json" in artifacts["api/docs.md"], "API docs should include data quality endpoint"
    assert "GET api/changes.json" in artifacts["api/docs.md"], "API docs should include changes endpoint"
    assert "GET api/examples.json" in artifacts["api/docs.md"], "API docs should include examples endpoint"
    assert "GET api/indexes/vendors.json" in artifacts["api/docs.md"], "API docs should include split search indexes"
    assert "algorithm_extraction" in artifacts["api/docs.md"], "API docs should describe extraction provenance"

    index_payload = build_index_payload(metadata, algorithms_summary)
    assert index_payload["endpoints"]["certificate_index"] == "/api/certificates/index.json", "Index payload should advertise certificate index"
    assert index_payload["documentation"]["llms_full_txt"] == "/llms-full.txt", "Index payload should advertise llms-full.txt"
    assert index_payload["documentation"]["json_schemas"] == "/api/schemas/index.schema.json", "Index payload should advertise JSON schemas"
    assert index_payload["schemas"]["certificate_index"] == "/api/schemas/certificate-index.schema.json", "Index payload should advertise certificate index schema"
    assert index_payload["schemas"]["certificate_detail"] == "/api/schemas/certificate-detail.schema.json", "Index payload should advertise certificate detail schema"
    assert index_payload["schemas"]["data_quality"] == "/api/schemas/data-quality.schema.json", "Index payload should advertise data quality schema"
    assert index_payload["schemas"]["changes"] == "/api/schemas/changes.schema.json", "Index payload should advertise changes schema"
    assert index_payload["schemas"]["examples"] == "/api/schemas/examples.schema.json", "Index payload should advertise examples schema"
    assert index_payload["schemas"]["search_index"] == "/api/schemas/search-index.schema.json", "Index payload should advertise search index schema"
    assert index_payload["endpoints"]["data_quality"] == "/api/data-quality.json", "Index payload should advertise data quality endpoint"
    assert index_payload["endpoints"]["changes"] == "/api/changes.json", "Index payload should advertise changes endpoint"
    assert index_payload["endpoints"]["examples"] == "/api/examples.json", "Index payload should advertise examples endpoint"
    assert index_payload["endpoints"]["vendor_index"] == "/api/indexes/vendors.json", "Index payload should advertise vendor index"
    assert index_payload["features"]["markdown_api_docs"] is True, "Index payload should advertise Markdown docs support"
    assert index_payload["features"]["algorithm_extraction_provenance"] is True, "Index payload should advertise extraction provenance"
    assert index_payload["features"]["extraction_metrics"] is True, "Index payload should advertise extraction metrics"
    assert index_payload["features"]["certificate_index"] is True, "Index payload should advertise certificate index support"
    assert index_payload["features"]["data_quality_report"] is True, "Index payload should advertise data quality support"
    assert index_payload["features"]["changes_feed"] is True, "Index payload should advertise changes feed support"
    assert index_payload["features"]["consumer_examples"] is True, "Index payload should advertise examples support"
    assert index_payload["features"]["search_indexes"] is True, "Index payload should advertise search index support"
    assert index_payload["features"]["json_schemas"] is True, "Index payload should advertise JSON schema support"

    schema_artifacts = generate_json_schema_artifacts(algorithms_summary)
    assert "api/schemas/modules.schema.json" in schema_artifacts, "Missing modules JSON schema"
    assert "api/schemas/module-in-process.schema.json" in schema_artifacts, "Missing module-in-process JSON schema"
    assert "api/schemas/certificate-index.schema.json" in schema_artifacts, "Missing certificate index JSON schema"
    assert "api/schemas/certificate-detail.schema.json" in schema_artifacts, "Missing certificate detail JSON schema"
    assert "api/schemas/data-quality.schema.json" in schema_artifacts, "Missing data quality JSON schema"
    assert "api/schemas/changes.schema.json" in schema_artifacts, "Missing changes JSON schema"
    assert "api/schemas/examples.schema.json" in schema_artifacts, "Missing examples JSON schema"
    assert "api/schemas/search-index.schema.json" in schema_artifacts, "Missing search index JSON schema"
    assert "api/schemas/algorithms.schema.json" in schema_artifacts, "Missing algorithms JSON schema"
    assert schema_artifacts["api/schemas/modules-in-process.schema.json"]["properties"]["modules_in_process"]["items"]["$ref"] == "/api/schemas/module-in-process.schema.json", "Modules-in-process response should use its own row schema"
    assert schema_artifacts["api/schemas/module.schema.json"]["properties"]["algorithm_extraction"]["type"] == "object", "Module schema should include extraction provenance"
    assert schema_artifacts["api/schemas/certificate-detail.schema.json"]["properties"]["certificate"]["properties"]["algorithm_extraction"]["type"] == "object", "Certificate detail schema should include extraction provenance"
    data_quality_schema = schema_artifacts["api/schemas/data-quality.schema.json"]
    assert "deferred_certificates" in data_quality_schema["properties"], "Data quality schema should document deferred certificates"
    assert "algorithm_coverage" in data_quality_schema["properties"], "Data quality schema should document algorithm coverage"
    assert "deferred_certificates" not in data_quality_schema["required"], "Deferred certificates should remain optional for old artifacts"
    assert "algorithm_coverage" not in data_quality_schema["required"], "Algorithm coverage should remain optional for old artifacts"
    changes_schema = schema_artifacts["api/schemas/changes.schema.json"]
    assert changes_schema["properties"]["max_runs"]["minimum"] == 1, "Changes schema should document max_runs"

    openapi = generate_openapi_spec(
        [sample_module],
        metadata,
        sample_detail,
        algorithms_summary,
    )
    assert "/api/algorithms.json" in openapi["paths"], "OpenAPI spec should include algorithms endpoint when available"
    assert "/api/certificates/index.json" in openapi["paths"], "OpenAPI spec should include certificate index endpoint"
    assert "/api/data-quality.json" in openapi["paths"], "OpenAPI spec should include data quality endpoint"
    assert "/api/changes.json" in openapi["paths"], "OpenAPI spec should include changes endpoint"
    assert "/api/examples.json" in openapi["paths"], "OpenAPI spec should include examples endpoint"
    assert "/api/indexes/vendors.json" in openapi["paths"], "OpenAPI spec should include vendor index endpoint"
    assert openapi["components"]["schemas"]["Module"]["properties"]["detail_available"]["type"] == "boolean", "detail_available should be typed as boolean"
    module_properties = openapi["components"]["schemas"]["Module"]["properties"]
    certificate_properties = openapi["components"]["schemas"]["CertificateDetail"]["properties"]
    metadata_properties = openapi["components"]["schemas"]["Metadata"]["properties"]
    for key in ("software_versions", "hardware_versions", "firmware_versions"):
        assert key in module_properties, f"OpenAPI module schema should include {key}"
        assert key in certificate_properties, f"OpenAPI certificate detail schema should include {key}"
        assert module_properties[key]["nullable"] is True, f"OpenAPI module schema should mark {key} nullable"
    assert "algorithm_extraction" in module_properties, "OpenAPI module schema should include algorithm_extraction"
    assert "algorithm_extraction" in certificate_properties, "OpenAPI certificate schema should include algorithm_extraction"
    assert "extraction_metrics" in metadata_properties, "OpenAPI metadata schema should include extraction metrics"

    canonical_base = "https://ethanolivertroy.github.io/nist-cmvp-api"
    assert index_payload["base_url"] == canonical_base
    assert build_examples_payload(metadata)["base_url"] == canonical_base
    assert openapi["servers"][0]["url"].rstrip("/") == canonical_base
    for path, schema in schema_artifacts.items():
        if "$id" in schema:
            assert schema["$id"] == f"{canonical_base}/{path}"
    for path in ("llms.txt", "llms-full.txt", "api/docs.md"):
        assert canonical_base in artifacts[path], path
    assert "https://github.com/ethanolivertroy/nist-cmvp-api" in artifacts["index.html"]
    generated = json.dumps([artifacts, index_payload, schema_artifacts, openapi, build_examples_payload(metadata)])
    assert "hackidle.github.io/nist-cmvp-api" not in generated
    assert "Auto-updated weekly" not in generated
    assert "Updated weekly." not in generated

    print("✓ Agent-friendly docs generation test passed")


def test_checked_in_consumer_docs_use_current_origin():
    """Checked-in docs, workflows, and skills must not point to the retired origin or stale claims."""
    root = Path(__file__).parent
    paths = [
        root / name
        for name in (
            "README.md",
            "workflows/update-cmvp-api.yml.example",
            "workflows/data-freshness.yml.example",
            "skills/nist-cmvp-pipeline/SKILL.md",
        )
    ]
    for path in paths:
        assert path.exists(), f"Missing expected doc/template: {path}"
        text = path.read_text(encoding="utf-8")
        assert "hackidle.github.io/nist-cmvp-api" not in text, str(path)
        assert "Auto-updated weekly" not in text, str(path)
        assert "Auto-updates weekly" not in text, str(path)
        assert "Updated weekly." not in text, str(path)
    assert scraper_module.PUBLIC_BASE_URL == "https://ethanolivertroy.github.io/nist-cmvp-api"
    assert scraper_module.REPO_URL == "https://github.com/ethanolivertroy/nist-cmvp-api"
    assert "certificates/{certificate}.json" in (root / "README.md").read_text(encoding="utf-8")


def main():
    """Run all tests."""
    print("=" * 60)
    print("Testing NIST CMVP Scraper")
    print("=" * 60)
    print()
    
    try:
        test_parse_simple_table()
        test_parse_table_without_thead()
        test_parse_empty_table()
        test_parse_historical_modules_table()
        test_parse_modules_in_process()
        test_parse_table_preserves_inline_spacing()
        test_parse_certificate_detail_page()
        test_reused_certificate_detail_migrates_version_schema_fields()
        test_process_certificate_record_reuses_legacy_detail_with_migrated_fields()
        test_parse_algorithms_from_policy_text()
        test_algorithm_detail_cleanup_removes_pdf_boilerplate()
        test_parse_algorithms_from_legacy_policy_text()
        test_extract_legacy_algorithm_section_prefers_body_over_toc()
        test_parse_real_world_fips_140_3_policy_fixture()
        test_parse_real_world_fips_140_2_policy_fixture()
        test_parse_real_world_fips_140_2_policy_fixture_without_algorithm_heading()
        test_parse_real_world_fips_140_2_policy_fixture_unnumbered_allowed_stop()
        test_parse_legacy_algorithm_rows_extracts_certificate_rows()
        test_parse_algorithms_from_policy_markdown()
        test_extract_text_from_crawl4ai_html()
        test_extract_text_from_crawl4ai_process_result()
        test_select_algorithm_source()
        test_build_certificate_fingerprint()
        test_should_reuse_cached_algorithms()
        test_algorithm_extraction_provenance_and_metrics()
        test_fetch_policy_pdf_bytes_reuses_in_run_cache()
        test_fetch_policy_pdf_bytes_shields_shared_cache_task_from_cancellation()
        test_fetch_with_retry_uses_jitter_and_four_attempts()
        test_process_certificate_record_applies_cached_algorithm_provenance()
        test_process_certificate_record_timeout_preserves_cached_data()
        test_process_certificate_record_preserves_cache_after_refresh_failure()
        test_build_certificate_artifacts_defers_uncached_failures()
        test_build_shard_records_preserves_original_indices_after_deferral()
        test_compact_shard_modules_omits_deferred_catalog_slots()
        test_save_sharded_changes_feed_preserves_history()
        test_save_sharded_changes_feed_excludes_deferred_certificates_from_removals()
        test_sharded_deferred_baseline_survives_saved_output_reload()
        test_sharded_deferred_baseline_lifecycle()
        test_sharded_invocations_have_distinct_run_ids_with_frozen_clock()
        test_single_container_invocations_keep_distinct_artifacts_with_frozen_clock()
        test_nonsharded_main_recovers_shared_sharded_baseline()
        test_process_shard_persists_deferred_certificates()
        test_process_shard_loads_database_algorithm_map()
        test_sharded_reducer_reports_deferred_certificates()
        test_module_rows_with_cache_fallback_preserves_previous_top_level_list()
        test_build_certificate_artifacts_bounds_active_tasks()
        test_build_data_quality_report_marks_repeat_deferrals()
        test_build_data_quality_report_algorithm_coverage_buckets()
        test_prune_orphan_certificate_details()
        test_build_changes_feed_first_run_empty_diffs()
        test_build_changes_feed_appends_current_diff()
        test_build_changes_feed_caps_runs()
        test_validate_generated_api_artifacts()
        test_build_certificate_index_payload()
        test_data_quality_search_indexes_and_examples()
        test_generate_agent_docs()
        test_checked_in_consumer_docs_use_current_origin()
        
        print()
        print("=" * 60)
        print("All tests passed! ✓")
        print("=" * 60)
        return 0
    except AssertionError as e:
        print(f"\n✗ Test failed: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
