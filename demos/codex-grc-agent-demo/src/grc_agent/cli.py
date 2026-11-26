from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from .models import AssessmentInput


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Codex GRC assessment demo")
    subparsers = parser.add_subparsers(dest="command", required=True)

    assess = subparsers.add_parser("assess", help="Run a GRC assessment.")
    assess.add_argument("--framework", required=True, help="Framework name.")
    assess.add_argument("--baseline", required=True, help="Baseline or profile name.")
    assess.add_argument(
        "--scope",
        default="demo workspace",
        help="Optional scope description for the assessment.",
    )
    assess.add_argument("--output", help="Optional JSON output path.")
    assess.add_argument("paths", nargs="+", help="Input SSP and evidence paths.")
    return parser


async def _run_assess(args: argparse.Namespace) -> int:
    try:
        from .agent import run_assessment
    except ModuleNotFoundError as exc:
        if exc.name == "agents":
            print(
                "Missing dependency: install the OpenAI Agents SDK with "
                "`pip install -e .` before running assessments.",
                file=sys.stderr,
            )
            return 1
        raise

    request = AssessmentInput(
        framework=args.framework,
        baseline=args.baseline,
        scope=args.scope,
        input_paths=args.paths,
    )

    assessment = await run_assessment(request)
    payload = json.dumps(assessment.model_dump(mode="json"), indent=2)

    if args.output:
        output_path = Path(args.output).resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(payload + "\n")

    print(payload)
    return 0


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "assess":
        raise SystemExit(asyncio.run(_run_assess(args)))

    raise SystemExit(parser.format_usage())

