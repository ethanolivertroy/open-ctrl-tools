from __future__ import annotations

import os
from pathlib import Path
from textwrap import dedent

from pydantic import BaseModel, Field

from agents import Agent, Runner, function_tool
from agents.extensions.experimental.codex import ThreadOptions, TurnOptions, codex_tool

from .datasets import (
    format_poam_entry,
    get_baseline_controls,
    get_control_metadata,
    get_shared_responsibility_hint,
)
from .models import AssessmentInput, AssessmentResult


class ReviewRequest(BaseModel):
    control_ids: list[str] = Field(description="Controls to review.")
    question: str = Field(description="Specific question for the specialist agent.")
    evidence_paths: list[str] = Field(default_factory=list)


class PolicyReviewResult(BaseModel):
    summary: str
    covered_controls: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)


class EvidenceReviewResult(BaseModel):
    summary: str
    relevant_evidence: list[str] = Field(default_factory=list)
    missing_evidence: list[str] = Field(default_factory=list)


def _resolve_path(raw_path: str, working_directory: Path) -> Path:
    candidate = Path(raw_path)
    if candidate.is_absolute():
        return candidate.resolve()
    return (working_directory / candidate).resolve()


def resolve_input_paths(input_paths: list[str], working_directory: Path) -> list[str]:
    resolved: list[str] = []
    for raw_path in input_paths:
        path = _resolve_path(raw_path, working_directory)
        if path.is_dir():
            for child in sorted(p for p in path.rglob("*") if p.is_file()):
                resolved.append(str(child))
        else:
            resolved.append(str(path))
    return list(dict.fromkeys(resolved))


def _read_excerpt(path: Path) -> str:
    try:
        return path.read_text()[:1800]
    except UnicodeDecodeError:
        return "[binary or non-text file]"
    except FileNotFoundError:
        return "[file not found]"


def build_prompt(
    request: AssessmentInput,
    controls: list[str],
    evidence_paths: list[str],
) -> str:
    evidence_manifest = "\n".join(
        f"- {path}\n{_read_excerpt(Path(path))}" for path in evidence_paths
    )
    controls_text = ", ".join(controls)

    return dedent(
        f"""
        Assess the provided workspace against {request.framework} / {request.baseline}.

        Scope: {request.scope}
        Controls to consider: {controls_text}

        Rules:
        - Use deterministic tools for baseline and control facts.
        - Use the policy specialist for narrative and SSP analysis.
        - Use the evidence specialist for local evidence inspection.
        - Only create POA&M items for `partial` or `not_satisfied` findings.
        - Keep the final answer strictly inside the AssessmentResult schema.

        Evidence manifest:
        {evidence_manifest or "No evidence paths were provided."}
        """
    ).strip()


def build_workspace_tool(working_directory: Path):
    return codex_tool(
        sandbox_mode="workspace-write",
        working_directory=str(working_directory),
        skip_git_repo_check=True,
        default_thread_options=ThreadOptions(
            model=os.getenv("OPENAI_AGENT_MODEL", "gpt-5.4"),
            model_reasoning_effort=os.getenv("CODEX_REASONING_EFFORT", "low"),
            network_access_enabled=False,
            web_search_mode="disabled",
            approval_policy="never",
        ),
        default_turn_options=TurnOptions(idle_timeout_seconds=60),
        persist_session=True,
    )


@function_tool
def baseline_controls_tool(baseline: str) -> list[str]:
    """Return control identifiers for the selected baseline."""
    return get_baseline_controls(baseline)


@function_tool
def control_metadata_tool(control_id: str) -> dict:
    """Return deterministic control metadata for a single control."""
    return get_control_metadata(control_id)


@function_tool
def shared_responsibility_tool(control_id: str) -> str:
    """Return a shared-responsibility hint for a control."""
    return get_shared_responsibility_hint(control_id)


@function_tool
def poam_formatter_tool(
    control_id: str,
    weakness_description: str,
    remediation_plan: str,
    scheduled_completion_date: str,
) -> dict:
    """Create a POA&M-ready remediation entry."""
    return format_poam_entry(
        control_id=control_id,
        weakness_description=weakness_description,
        remediation_plan=remediation_plan,
        scheduled_completion_date=scheduled_completion_date,
    ).model_dump()


def build_assessor_agent(working_directory: Path) -> Agent:
    workspace_tool = build_workspace_tool(working_directory)

    policy_reviewer = Agent(
        name="Policy Reviewer",
        model=os.getenv("OPENAI_AGENT_MODEL", "gpt-5.4"),
        instructions=dedent(
            """
            Review policy and SSP narrative against the requested controls.
            Use codex for exact file inspection and control_metadata_tool for
            factual control context. Return concise coverage, gaps, and the
            evidence paths that support your analysis.
            """
        ).strip(),
        output_type=PolicyReviewResult,
        tools=[control_metadata_tool, shared_responsibility_tool, workspace_tool],
    )

    evidence_reviewer = Agent(
        name="Evidence Reviewer",
        model=os.getenv("OPENAI_AGENT_MODEL", "gpt-5.4"),
        instructions=dedent(
            """
            Inspect local evidence artifacts and identify whether they support
            or weaken the requested controls. Use codex for file inspection,
            grep-like search, and workspace-scoped shell commands only.
            """
        ).strip(),
        output_type=EvidenceReviewResult,
        tools=[control_metadata_tool, workspace_tool],
    )

    return Agent(
        name="GRC Assessor",
        model=os.getenv("OPENAI_AGENT_MODEL", "gpt-5.4"),
        instructions=dedent(
            """
            You are a governance, risk, and compliance assessor.

            Keep ownership of the final answer. Use the deterministic tools for
            baseline facts and POA&M formatting, and call the specialist tools
            when you need help reading narrative content or local evidence.

            The final output must be a valid AssessmentResult object.
            """
        ).strip(),
        output_type=AssessmentResult,
        tools=[
            baseline_controls_tool,
            control_metadata_tool,
            shared_responsibility_tool,
            poam_formatter_tool,
            policy_reviewer.as_tool(
                tool_name="review_policy_text",
                tool_description="Review SSP or policy narrative for requested controls.",
                parameters=ReviewRequest,
                include_input_schema=True,
            ),
            evidence_reviewer.as_tool(
                tool_name="review_evidence_artifacts",
                tool_description="Inspect local evidence artifacts for requested controls.",
                parameters=ReviewRequest,
                include_input_schema=True,
            ),
        ],
    )


async def run_assessment(
    request: AssessmentInput,
    working_directory: Path | None = None,
) -> AssessmentResult:
    repo_root = (working_directory or Path.cwd()).resolve()
    evidence_paths = resolve_input_paths(request.input_paths, repo_root)
    controls = get_baseline_controls(request.baseline)
    prompt = build_prompt(request, controls, evidence_paths)

    result = await Runner.run(build_assessor_agent(repo_root), prompt)

    if isinstance(result.final_output, AssessmentResult):
        return result.final_output

    return AssessmentResult.model_validate(result.final_output)

