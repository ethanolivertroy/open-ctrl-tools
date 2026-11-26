import os
import stat
import tempfile
import unittest
from unittest.mock import MagicMock, patch

from fedramp_check import (
    check_audit_logging,
    check_password_policy,
    check_two_step_verification,
    get_config_from_sources,
    save_token_securely,
)


def report_for(check_id: str) -> dict:
    return {
        "checks": [{"id": check_id, "status": "Not Checked", "details": ""}],
        "summary": {"compliant": 0, "non_compliant": 0, "not_checked": 1},
    }


class ManualCheckTests(unittest.TestCase):
    def test_password_policy_remains_manual(self) -> None:
        report = report_for("password-policy")

        check_password_policy(None, report)

        self.assertEqual(report["checks"][0]["status"], "Not Checked")
        self.assertEqual(report["summary"], {"compliant": 0, "non_compliant": 0, "not_checked": 1})

    def test_two_step_verification_remains_manual(self) -> None:
        report = report_for("two-step-verification")

        check_two_step_verification(None, report)

        self.assertEqual(report["checks"][0]["status"], "Not Checked")
        self.assertEqual(report["summary"], {"compliant": 0, "non_compliant": 0, "not_checked": 1})

    def test_empty_audit_log_is_inconclusive(self) -> None:
        report = report_for("audit-logging")
        reports_service = MagicMock()
        reports_service.activities.return_value.list.return_value.execute.return_value = {}

        with patch("fedramp_check.build", return_value=reports_service):
            check_audit_logging(MagicMock(), report)

        self.assertEqual(report["checks"][0]["status"], "Not Checked")
        self.assertIn("No admin audit events", report["checks"][0]["details"])
        self.assertEqual(report["summary"], {"compliant": 0, "non_compliant": 0, "not_checked": 1})

    def test_saved_token_is_owner_only(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            token_path = os.path.join(directory, "token.json")
            with open(token_path, "w", encoding="utf-8") as token:
                token.write("old")
            os.chmod(token_path, 0o644)

            save_token_securely(token_path, '{"refresh_token":"redacted"}')

            self.assertEqual(stat.S_IMODE(os.stat(token_path).st_mode), 0o600)
            with open(token_path, encoding="utf-8") as token:
                self.assertEqual(token.read(), '{"refresh_token":"redacted"}')

    @unittest.skipUnless(hasattr(os, "O_NOFOLLOW"), "platform lacks O_NOFOLLOW")
    def test_saved_token_does_not_follow_symlinks(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            target_path = os.path.join(directory, "target.json")
            token_path = os.path.join(directory, "token.json")
            with open(target_path, "w", encoding="utf-8") as target:
                target.write("unchanged")
            os.symlink(target_path, token_path)

            with self.assertRaises(OSError):
                save_token_securely(token_path, '{"refresh_token":"redacted"}')

            with open(target_path, encoding="utf-8") as target:
                self.assertEqual(target.read(), "unchanged")


class ConfigurationTests(unittest.TestCase):
    def test_explicit_auth_method_keeps_companion_credential(self) -> None:
        cases = (
            ("service_account", "service_account", "service-account.json", "service_account_path"),
            ("gcp_secret", "gcp_secret_credentials", "oauth-secret", "gcp_secret_credentials"),
            ("aws_secret", "aws_secret_name", "workspace/oauth", "aws_secret_name"),
            ("vault", "vault_path", "workspace/oauth", "vault_path"),
        )

        with patch.dict(os.environ, {}, clear=True):
            for method, argument, value, config_key in cases:
                with self.subTest(method=method):
                    config = get_config_from_sources({"auth_method": method, argument: value})
                    self.assertEqual(config["auth_method"], method)
                    self.assertEqual(config[config_key], value)

    def test_config_file_auth_method_is_preserved_without_a_selector(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            config_path = os.path.join(directory, "fedramp_config.json")
            with open(config_path, "w", encoding="utf-8") as config_file:
                config_file.write('{"auth_method":"vault","vault_path":"workspace/oauth"}')

            with patch.dict(os.environ, {}, clear=True):
                config = get_config_from_sources({"config_file": config_path})

            self.assertEqual(config["auth_method"], "vault")
            self.assertEqual(config["vault_path"], "workspace/oauth")


if __name__ == "__main__":
    unittest.main()
