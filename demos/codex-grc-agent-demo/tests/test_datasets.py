from grc_agent.datasets import (
    format_poam_entry,
    get_baseline_controls,
    get_control_metadata,
    get_shared_responsibility_hint,
)


def test_get_baseline_controls() -> None:
    controls = get_baseline_controls("FedRAMP Moderate")
    assert controls == ["AC-2", "IA-5", "AU-6", "CM-6"]


def test_get_control_metadata() -> None:
    metadata = get_control_metadata("AC-2")
    assert metadata["title"] == "Account Management"


def test_shared_responsibility_hint_defaults() -> None:
    assert get_shared_responsibility_hint("AU-6") == "shared"
    assert get_shared_responsibility_hint("UNKNOWN-1") == "shared"


def test_format_poam_entry() -> None:
    poam = format_poam_entry(
        control_id="CM-6",
        weakness_description="Drift detection is incomplete.",
        remediation_plan="Roll out policy-as-code checks for all namespaces.",
        scheduled_completion_date="2026-06-30",
    )
    assert poam.control_id == "CM-6"
    assert poam.source == "assessment"
