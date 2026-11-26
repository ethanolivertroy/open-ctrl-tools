"""
Enumerations for Wilma Security Modes and Risk Levels

Copyright (C) 2024  Ethan Troy

Licensed under the MIT License; see LICENSE for details.
"""

from enum import Enum


class SecurityMode(Enum):
    """Security check operational modes."""
    STANDARD = "standard"
    LEARN = "learn"


class RiskLevel(Enum):
    """Risk level classifications with scoring."""
    CRITICAL = (9, "[CRITICAL]", "CRITICAL")
    HIGH = (8, "[HIGH]", "HIGH")
    MEDIUM = (6, "[MEDIUM]", "MEDIUM")
    LOW = (3, "[LOW]", "LOW")
    INFO = (1, "[INFO]", "INFO")

    def __init__(self, score, symbol, label):
        self.score = score
        self.symbol = symbol
        self.label = label
