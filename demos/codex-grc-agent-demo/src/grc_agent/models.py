from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


AssessmentStatus = Literal["satisfied", "partial", "not_satisfied"]
Severity = Literal["low", "moderate", "high"]
OriginationHint = Literal["service_provider", "customer", "shared", "inherited"]


class AssessmentInput(BaseModel):
    framework: str
    baseline: str
    input_paths: list[str] = Field(min_length=1)
    scope: str = "demo workspace"


class Finding(BaseModel):
    control_id: str
    title: str
    status: AssessmentStatus = Field(
        description="Control status: satisfied, partial, or not_satisfied."
    )
    severity: Severity = Field(description="Risk severity for this finding.")
    rationale: str
    evidence: list[str] = Field(default_factory=list)
    recommendation: str | None = None
    origination_hint: OriginationHint | None = None


class ComplianceRollup(BaseModel):
    satisfied: int = 0
    partial: int = 0
    not_satisfied: int = 0


class PoamEntry(BaseModel):
    control_id: str
    weakness_description: str
    remediation_plan: str
    scheduled_completion_date: str
    source: Literal["assessment", "scan", "conmon", "incident"] = "assessment"


class AssessmentResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    framework: str
    baseline: str
    summary: str
    rollup: ComplianceRollup
    findings: list[Finding]
    poam: list[PoamEntry] = Field(default_factory=list)
    evidence_reviewed: list[str] = Field(default_factory=list)
    controls_considered: list[str] = Field(default_factory=list)

