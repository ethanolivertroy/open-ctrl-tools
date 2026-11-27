#!/usr/bin/env python3
"""
Generate assessment interview questions for framework controls using Claude API.

Usage:
    # Generate for NIST 800-53 (primary source)
    python scripts/generate_assessment_questions.py --framework nist-800-53-r5

    # Copy NIST questions to FedRAMP/DoD SRG by matching control IDs
    python scripts/generate_assessment_questions.py --copy-from nist-800-53-r5 --to fedramp-rev5
    python scripts/generate_assessment_questions.py --copy-from nist-800-53-r5 --to dod-srg

    # Generate independently for non-NIST-subset frameworks
    python scripts/generate_assessment_questions.py --framework fedramp-20x-ksi
    python scripts/generate_assessment_questions.py --framework nist-800-171-r2
    python scripts/generate_assessment_questions.py --framework nist-800-171-r3
    python scripts/generate_assessment_questions.py --framework cmmc-v2

    # Resume from a specific control index (after interruption)
    python scripts/generate_assessment_questions.py --framework nist-800-53-r5 --start-index 500

    # Dry run (don't call API, just show what would be processed)
    python scripts/generate_assessment_questions.py --framework nist-800-53-r5 --dry-run
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import anthropic
from dotenv import load_dotenv

load_dotenv()

DATA_DIR = Path(__file__).parent.parent / "src" / "data"
CLAUDE_MODEL = "claude-sonnet-4-20250514"

# Frameworks that are subsets of NIST 800-53 — copy by control ID
NIST_SUBSET_FRAMEWORKS = {"fedramp-rev5", "dod-srg"}

# Framework-specific prompt context
FRAMEWORK_PROMPTS = {
    "nist-800-53-r5": {
        "assessor_type": "FedRAMP 3PAO / FISMA assessor",
        "context": "NIST SP 800-53 Rev 5 security and privacy controls for federal information systems",
    },
    "fedramp-20x-ksi": {
        "assessor_type": "FedRAMP assessor evaluating key security indicators",
        "context": "FedRAMP 20x Key Security Indicators — high-level security outcomes for cloud service providers",
    },
    "nist-800-171-r2": {
        "assessor_type": "CMMC assessor / DoD supply chain auditor",
        "context": "NIST SP 800-171 Rev 2 — protecting Controlled Unclassified Information (CUI) in nonfederal systems",
    },
    "nist-800-171-r3": {
        "assessor_type": "CMMC assessor / DoD supply chain auditor",
        "context": "NIST SP 800-171 Rev 3 — protecting CUI with updated requirements aligned to 800-53 Rev 5",
    },
    "cmmc-v2": {
        "assessor_type": "CMMC Certified Third-Party Assessor Organization (C3PAO)",
        "context": "CMMC v2.0 practices — DoD cybersecurity maturity model for defense contractors",
    },
}


def build_prompt(control: dict[str, Any], framework_id: str) -> str:
    """Build the Claude prompt for generating assessment questions."""
    prompt_ctx = FRAMEWORK_PROMPTS.get(framework_id, {
        "assessor_type": "security assessor",
        "context": f"security controls from the {framework_id} framework",
    })

    # Gather available control context
    parts = [f"Control ID: {control['control_id']}"]
    parts.append(f"Title: {control['title']}")
    if control.get("description"):
        parts.append(f"Description: {control['description']}")
    if control.get("supplemental_guidance"):
        parts.append(f"Supplemental Guidance: {control['supplemental_guidance']}")
    if control.get("discussion"):
        parts.append(f"Discussion: {control['discussion']}")

    control_text = "\n".join(parts)

    return f"""You are a {prompt_ctx['assessor_type']} preparing interview questions for an assessment of {prompt_ctx['context']}.

Given the following control, generate assessment interview questions that a real assessor would ask during an audit. Categorize them into 2-3 groups:

1. "Process & Governance" — questions about policies, procedures, roles, and accountability
2. "Technical Implementation" — questions about how the control is technically implemented
3. "Evidence & Documentation" — questions about what artifacts, logs, or records demonstrate compliance

Rules:
- Generate 3-5 concise, actionable questions per category
- Questions should probe for real evidence, not just yes/no answers
- Don't restate the control description as a question
- Focus on what distinguishes compliant from non-compliant implementations
- Use plain language an IT professional would understand

{control_text}

Respond with ONLY valid JSON in this exact format (no markdown, no explanation):
[
  {{
    "category": "Process & Governance",
    "questions": ["question1", "question2", "question3"]
  }},
  {{
    "category": "Technical Implementation",
    "questions": ["question1", "question2", "question3"]
  }},
  {{
    "category": "Evidence & Documentation",
    "questions": ["question1", "question2", "question3"]
  }}
]"""


def generate_questions(client: anthropic.Anthropic, control: dict[str, Any], framework_id: str) -> list[dict] | None:
    """Call Claude to generate assessment questions for a single control."""
    prompt = build_prompt(control, framework_id)

    try:
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text.strip()
        questions = json.loads(text)

        # Validate structure
        if not isinstance(questions, list):
            print(f"  WARNING: Invalid response structure for {control['control_id']}")
            return None

        for group in questions:
            if not isinstance(group, dict) or "category" not in group or "questions" not in group:
                print(f"  WARNING: Invalid group structure for {control['control_id']}")
                return None
            if not isinstance(group["questions"], list) or len(group["questions"]) < 2:
                print(f"  WARNING: Too few questions for {control['control_id']}")
                return None

        return questions

    except json.JSONDecodeError as e:
        print(f"  ERROR: JSON parse failed for {control['control_id']}: {e}")
        return None
    except anthropic.APIError as e:
        print(f"  ERROR: API error for {control['control_id']}: {e}")
        return None


def process_framework(framework_id: str, batch_size: int = 5, start_index: int = 0, dry_run: bool = False):
    """Generate assessment questions for all controls in a framework."""
    json_path = DATA_DIR / f"{os.path.basename(framework_id)}.json"
    if not json_path.exists():
        print(f"ERROR: {json_path} not found")
        sys.exit(1)

    with open(json_path) as f:
        data = json.load(f)

    controls = data["controls"]
    total = len(controls)
    print(f"\nFramework: {framework_id}")
    print(f"Controls: {total}")
    print(f"Starting from index: {start_index}")

    if dry_run:
        print(f"DRY RUN — would process {total - start_index} controls")
        for i, ctrl in enumerate(controls[start_index:start_index + 5], start=start_index):
            has_q = "assessment_questions" in ctrl and ctrl["assessment_questions"]
            print(f"  [{i}] {ctrl['control_id']} — {'HAS questions' if has_q else 'needs generation'}")
        if total > start_index + 5:
            print(f"  ... and {total - start_index - 5} more")
        return

    client = anthropic.Anthropic()
    generated = 0
    skipped = 0
    errors = 0

    for i, control in enumerate(controls[start_index:], start=start_index):
        # Skip controls that already have questions
        if control.get("assessment_questions") and len(control["assessment_questions"]) > 0:
            skipped += 1
            continue

        print(f"  [{i + 1}/{total}] {control['control_id']}...", end=" ", flush=True)

        questions = generate_questions(client, control, framework_id)
        if questions:
            control["assessment_questions"] = questions
            generated += 1
            print(f"OK ({sum(len(g['questions']) for g in questions)} questions)")
        else:
            errors += 1
            print("FAILED")

        # Save periodically
        if generated > 0 and generated % batch_size == 0:
            with open(json_path, "w") as f:
                json.dump(data, f, indent=2)
            print(f"  --- Saved ({generated} generated so far) ---")

        # Rate limiting: ~50 req/min for Sonnet
        time.sleep(1.2)

    # Final save
    if generated > 0:
        with open(json_path, "w") as f:
            json.dump(data, f, indent=2)

    print(f"\nDone: {generated} generated, {skipped} skipped (already had questions), {errors} errors")


def copy_questions(source_id: str, target_id: str):
    """Copy assessment questions from one framework to another by matching control IDs."""
    source_path = DATA_DIR / f"{os.path.basename(source_id)}.json"
    target_path = DATA_DIR / f"{os.path.basename(target_id)}.json"

    if not source_path.exists():
        print(f"ERROR: Source {source_path} not found")
        sys.exit(1)
    if not target_path.exists():
        print(f"ERROR: Target {target_path} not found")
        sys.exit(1)

    with open(source_path) as f:
        source_data = json.load(f)
    with open(target_path) as f:
        target_data = json.load(f)

    # Build lookup from source
    source_questions: dict[str, list] = {}
    for ctrl in source_data["controls"]:
        if ctrl.get("assessment_questions"):
            source_questions[ctrl["control_id"]] = ctrl["assessment_questions"]

    copied = 0
    missing = 0

    for ctrl in target_data["controls"]:
        cid = ctrl["control_id"]
        if cid in source_questions:
            ctrl["assessment_questions"] = source_questions[cid]
            copied += 1
        else:
            missing += 1

    with open(target_path, "w") as f:
        json.dump(target_data, f, indent=2)

    print(f"\nCopied {source_id} -> {target_id}: {copied} controls updated, {missing} not found in source")


def main():
    parser = argparse.ArgumentParser(description="Generate assessment interview questions for framework controls")
    parser.add_argument("--framework", help="Framework ID to generate questions for")
    parser.add_argument("--copy-from", dest="copy_from", help="Source framework to copy questions from")
    parser.add_argument("--to", dest="copy_to", help="Target framework to copy questions to")
    parser.add_argument("--batch-size", type=int, default=10, help="Save every N generations (default: 10)")
    parser.add_argument("--start-index", type=int, default=0, help="Start from this control index (for resuming)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be processed without calling API")

    args = parser.parse_args()

    if args.copy_from and args.copy_to:
        copy_questions(args.copy_from, args.copy_to)
    elif args.framework:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            print("ERROR: ANTHROPIC_API_KEY not set. Add it to .env or export it.")
            sys.exit(1)
        process_framework(args.framework, args.batch_size, args.start_index, args.dry_run)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
