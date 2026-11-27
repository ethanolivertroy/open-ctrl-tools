"""JSON load/save helpers with consistent formatting.

Defaults mirror the formatting the generation scripts have always used
(``indent=2``, ASCII-escaped output, no trailing newline) so regenerated
files in src/data do not churn. Scripts that historically used
``ensure_ascii=False`` or wrote a trailing newline can opt in via the
keyword parameters.
"""

import json
from pathlib import Path
from typing import Any


def load_json(path: str | Path, encoding: str = "utf-8") -> Any:
    """Load a JSON file."""
    with open(path, encoding=encoding) as f:
        return json.load(f)


def save_json(
    path: str | Path,
    data: Any,
    *,
    indent: int = 2,
    ensure_ascii: bool = True,
    trailing_newline: bool = False,
    encoding: str = "utf-8",
) -> Path:
    """Write ``data`` to ``path`` as JSON, creating parent dirs as needed."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding=encoding) as f:
        json.dump(data, f, indent=indent, ensure_ascii=ensure_ascii)
        if trailing_newline:
            f.write("\n")
    return path
