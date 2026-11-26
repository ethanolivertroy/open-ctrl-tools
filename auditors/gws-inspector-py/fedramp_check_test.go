package main

import (
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/oauth2"
)

func TestPasswordPolicyRemainsManual(t *testing.T) {
	report := ComplianceReport{
		Checks:  []Check{{ID: "password-policy", Status: "Not Checked"}},
		Summary: Summary{NotChecked: 1},
	}

	checkPasswordPolicy(nil, &report)

	if got := report.Checks[0].Status; got != "Not Checked" {
		t.Fatalf("status = %q, want Not Checked", got)
	}
	if got := report.Summary.NotChecked; got != 1 {
		t.Fatalf("not_checked = %d, want 1 for a manual check", got)
	}
}

func TestTwoStepVerificationRemainsManual(t *testing.T) {
	report := ComplianceReport{
		Checks:  []Check{{ID: "two-step-verification", Status: "Not Checked"}},
		Summary: Summary{NotChecked: 1},
	}

	checkTwoStepVerification(nil, &report)

	if got := report.Checks[0].Status; got != "Not Checked" {
		t.Fatalf("status = %q, want Not Checked", got)
	}
	if got := report.Summary.NotChecked; got != 1 {
		t.Fatalf("not_checked = %d, want 1 for a manual check", got)
	}
}

func TestEmptyAuditLogIsInconclusive(t *testing.T) {
	report := ComplianceReport{
		Checks:  []Check{{ID: "audit-logging", Status: "Not Checked"}},
		Summary: Summary{NotChecked: 1},
	}

	applyAuditLoggingResult(false, &report)

	if got := report.Checks[0].Status; got != "Not Checked" {
		t.Fatalf("status = %q, want Not Checked", got)
	}
	if got := report.Summary; got != (Summary{NotChecked: 1}) {
		t.Fatalf("summary = %#v, want only one not-checked result", got)
	}
}

func TestSaveTokenReplacesSymlinkWithOwnerOnlyFile(t *testing.T) {
	directory := t.TempDir()
	targetPath := filepath.Join(directory, "target.json")
	tokenPath := filepath.Join(directory, "token.json")
	if err := os.WriteFile(targetPath, []byte("unchanged"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(targetPath, tokenPath); err != nil {
		t.Fatal(err)
	}

	if err := saveToken(tokenPath, &oauth2.Token{AccessToken: "redacted"}); err != nil {
		t.Fatal(err)
	}

	info, err := os.Lstat(tokenPath)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode()&os.ModeSymlink != 0 {
		t.Fatal("token path remained a symlink")
	}
	if got := info.Mode().Perm(); got != 0600 {
		t.Fatalf("token mode = %04o, want 0600", got)
	}
	if target, err := os.ReadFile(targetPath); err != nil {
		t.Fatal(err)
	} else if string(target) != "unchanged" {
		t.Fatalf("symlink target changed to %q", target)
	}
}
