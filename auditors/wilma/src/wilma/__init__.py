"""
Wilma - AWS Bedrock Security Posture Assessment

An AWS Bedrock security posture assessment tool that maps automated evidence to
Bedrock Security Indicators and external security frameworks.

Copyright (C) 2024  Ethan Troy

Licensed under the MIT License; see LICENSE for details.
"""

__version__ = "2.0.0"
__author__ = "Ethan Troy"
__license__ = "MIT"

from wilma.api import ScanResult, WilmaScanner
from wilma.checker import BedrockSecurityChecker
from wilma.enums import RiskLevel, SecurityMode
from wilma.exceptions import WilmaCredentialsError, WilmaError

__all__ = [
    "BedrockSecurityChecker",
    "RiskLevel",
    "ScanResult",
    "SecurityMode",
    "WilmaCredentialsError",
    "WilmaError",
    "WilmaScanner",
    "__version__",
]
