#!/usr/bin/env python3
"""
Run a small Ollama smoke eval against a local model.
"""

import argparse
from datetime import datetime
import json
import os
import sys
import time
from pathlib import Path

import requests

DEFAULT_CASES_PATH = Path("eval/ollama_smoke_cases.json")


def resolve_base_url() -> str:
    """Resolve the Ollama base URL from the environment."""
    raw = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw.rstrip("/")
    return f"http://{raw.rstrip('/')}"


def load_cases(path: Path) -> list[dict]:
    """Load eval cases from JSON."""
    payload = json.loads(path.read_text(encoding="utf-8"))
    return payload["cases"]


def normalize(text: str) -> str:
    """Normalize model output for lightweight substring checks."""
    return " ".join(text.lower().split())


def match_group(text: str, group: list[str]) -> str | None:
    """Return the matched phrase for a group, if any."""
    for phrase in group:
        if phrase.lower() in text:
            return phrase
    return None


def run_case(base_url: str, model: str, case: dict, timeout: float) -> dict:
    """Run a single eval case against Ollama."""
    started = time.perf_counter()
    response = requests.post(
        f"{base_url}/api/generate",
        json={
            "model": model,
            "prompt": case["prompt"],
            "stream": False,
        },
        timeout=timeout,
    )
    response.raise_for_status()

    body = response.json()
    output = body.get("response", "")
    normalized = normalize(output)

    matches = []
    misses = []
    for group in case["checks"]:
        matched = match_group(normalized, group)
        if matched:
            matches.append(matched)
        else:
            misses.append(group)

    minimum_checks = case.get("minimum_checks", len(case["checks"]))
    passed = len(matches) >= minimum_checks

    return {
        "id": case["id"],
        "prompt": case["prompt"],
        "output": output,
        "passed": passed,
        "matches": matches,
        "misses": misses,
        "minimum_checks": minimum_checks,
        "elapsed": time.perf_counter() - started,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run a small Ollama smoke eval against a local model"
    )
    parser.add_argument(
        "--model",
        default="hackidle-nist-coder",
        help="Ollama model name (default: hackidle-nist-coder)",
    )
    parser.add_argument(
        "--cases",
        type=Path,
        default=DEFAULT_CASES_PATH,
        help=f"Path to eval cases JSON (default: {DEFAULT_CASES_PATH})",
    )
    parser.add_argument(
        "--base-url",
        default=resolve_base_url(),
        help="Ollama base URL (default: OLLAMA_HOST or http://127.0.0.1:11434)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=120.0,
        help="Request timeout in seconds (default: 120)",
    )
    parser.add_argument(
        "--show-output",
        action="store_true",
        help="Print model output for every case",
    )
    parser.add_argument(
        "--show-failures",
        action="store_true",
        help="Print full model output for failed cases",
    )
    parser.add_argument(
        "--case",
        action="append",
        dest="case_ids",
        help="Run only the named case ID. Repeat to run more than one case.",
    )
    parser.add_argument(
        "--json-output",
        type=Path,
        help="Write a JSON report to this path",
    )

    args = parser.parse_args()

    if not args.cases.exists():
        print(f"Cases file not found: {args.cases}", file=sys.stderr)
        return 1

    cases = load_cases(args.cases)
    if args.case_ids:
        wanted = set(args.case_ids)
        cases = [case for case in cases if case["id"] in wanted]
        if not cases:
            print("No matching case IDs found.", file=sys.stderr)
            return 1

    print(f"Running {len(cases)} eval cases against {args.model}")
    print(f"Ollama base URL: {args.base_url}")
    print()

    failures = 0
    results = []
    for case in cases:
        try:
            result = run_case(args.base_url, args.model, case, args.timeout)
        except requests.RequestException as exc:
            print(f"[FAIL] {case['id']} request error: {exc}")
            failures += 1
            results.append(
                {
                    "id": case["id"],
                    "prompt": case["prompt"],
                    "passed": False,
                    "request_error": str(exc),
                }
            )
            continue

        status = "PASS" if result["passed"] else "FAIL"
        print(
            f"[{status}] {result['id']} "
            f"({len(result['matches'])}/{len(case['checks'])} checks, "
            f"needed {result['minimum_checks']}, {result['elapsed']:.1f}s)"
        )
        print(f"  matched: {', '.join(result['matches']) if result['matches'] else 'none'}")
        if result["misses"]:
            missing = [" / ".join(group) for group in result["misses"]]
            print(f"  missing: {', '.join(missing)}")

        if args.show_output or (args.show_failures and not result["passed"]):
            print("  output:")
            for line in result["output"].splitlines():
                print(f"    {line}")

        if not result["passed"]:
            failures += 1

        results.append(result)
        print()

    if args.json_output:
        report = {
            "generated_at": datetime.now().astimezone().isoformat(),
            "model": args.model,
            "base_url": args.base_url,
            "cases_file": str(args.cases),
            "total_cases": len(cases),
            "passed_cases": len(cases) - failures,
            "failed_cases": failures,
            "results": results,
        }
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"JSON report written to {args.json_output}")
        print()

    if failures:
        print(f"{failures} case(s) failed.")
        return 1

    print("All eval cases passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
