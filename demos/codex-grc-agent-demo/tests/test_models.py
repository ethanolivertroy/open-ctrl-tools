from grc_agent.models import AssessmentResult, ComplianceRollup, Finding


def test_assessment_result_defaults() -> None:
    result = AssessmentResult(
        framework="NIST 800-53",
        baseline="FedRAMP Moderate",
        summary="Demo result",
        rollup=ComplianceRollup(satisfied=1, partial=1, not_satisfied=0),
        findings=[
            Finding(
                control_id="AC-2",
                title="Account Management",
                status="partial",
                severity="moderate",
                rationale="Quarterly reviews are weaker than expected.",
            )
        ],
    )

    assert result.poam == []
    assert result.evidence_reviewed == []
    assert result.controls_considered == []
    assert result.rollup.partial == 1

