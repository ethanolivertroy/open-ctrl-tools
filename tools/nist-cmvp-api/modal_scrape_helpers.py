"""Pure helpers shared by the optional Modal scraper entrypoint."""

from __future__ import annotations

from collections import defaultdict, deque
from copy import deepcopy
from typing import Any, Iterable, Mapping


def _certificate_key(record: Mapping[str, object]) -> str:
    """Return the normalized CMVP certificate number used to correlate records."""
    return str(record.get("Certificate Number", "")).strip()


def build_indexed_shard_records(
    indexed_records: Iterable[tuple[int, dict[str, object]]],
    processed_modules: Iterable[dict[str, object]],
) -> list[dict[str, object]]:
    """Pair published shard modules with their original catalog indices."""
    indices_by_certificate: dict[str, deque[int]] = defaultdict(deque)
    for original_index, record in indexed_records:
        certificate_key = _certificate_key(record)
        if not certificate_key:
            raise ValueError(f"Catalog record {original_index} has no certificate number")
        indices_by_certificate[certificate_key].append(original_index)

    shard_records = []
    for processed_module in processed_modules:
        certificate_key = _certificate_key(processed_module)
        if not certificate_key or not indices_by_certificate[certificate_key]:
            raise ValueError(
                f"Processed certificate {certificate_key or '<missing>'} has no matching catalog record"
            )
        shard_records.append(
            {
                "index": indices_by_certificate[certificate_key].popleft(),
                "module": processed_module,
            }
        )
    return shard_records


def compact_shard_modules(
    modules: Iterable[dict[str, object] | None],
) -> list[dict[str, object]]:
    """Return published modules in catalog order without deferred empty slots."""
    return [module for module in modules if module is not None]


def save_sharded_changes_feed(
    scraper: Any,
    metadata: dict,
    modules: list[dict],
    historical_modules: list[dict],
    previous_outputs: dict,
    output_dir: str = "api",
    deferred_certificates: Iterable[Mapping[str, object]] = (),
) -> dict:
    """Save change history and last-known rows for temporarily deferred certificates.

    The sidecar travels with the accepted api/ cache and is loaded separately from
    published modules: stale rows are comparison evidence, not current catalog or
    extraction-cache entries. Keep their original dataset and full fingerprint
    inputs until they recover or disappear from the live catalog without deferral.
    """
    comparison_outputs = deepcopy(previous_outputs)
    comparison_modules = comparison_outputs.setdefault("modules", {})
    baseline = previous_outputs.get("changes_baseline", {})
    current = {"active": list(modules), "historical": list(historical_modules)}
    current_keys = {_certificate_key(module) for rows in current.values() for module in rows}
    deferred_keys = {
        str(record.get("certificate_number", "")).strip()
        for record in deferred_certificates
        if isinstance(record, Mapping)
    } - current_keys - {""}
    retained = {"active": [], "historical": []}
    for dataset in ("active", "historical"):
        previous = comparison_modules.setdefault(dataset, {})
        # JSON round-trips stringify map keys; the sidecar uses rows instead.
        for row in baseline.get(dataset, []):
            key = int(_certificate_key(row))
            previous.setdefault(key, row)
        for row in previous.values():
            if _certificate_key(row) in deferred_keys:
                retained[dataset].append(deepcopy(row))
                current[dataset].append(deepcopy(row))

    changes_feed = scraper.build_changes_feed(
        metadata,
        current["active"],
        current["historical"],
        comparison_outputs,
        previous_outputs.get("changes"),
    )
    # Always overwrite, including an empty baseline, to retire recovered/removed rows.
    scraper.save_json(retained, f"{output_dir}/changes-baseline.json")
    scraper.save_json(changes_feed, f"{output_dir}/changes.json")
    return changes_feed
