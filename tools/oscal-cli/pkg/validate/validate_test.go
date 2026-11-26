package validate

import (
	"path/filepath"
	"testing"

	"github.com/ethantroy/oscal-cli/pkg/oscal/io"
)

func TestValidatorCompilesAndValidatesAllFormats(t *testing.T) {
	v, err := NewValidator()
	if err != nil {
		t.Fatalf("NewValidator() failed: %v", err)
	}
	if got := len(SupportedDocumentTypes()); got != 7 {
		t.Fatalf("expected 7 supported OSCAL document types, got %d", got)
	}

	catalogPath := filepath.Join("..", "..", "testdata", "simple-catalog.json")
	res, err := v.ValidateFile(catalogPath)
	if err != nil {
		t.Fatalf("ValidateFile failed: %v", err)
	}
	if !res.Valid || res.DocumentType != "catalog" {
		t.Fatalf("expected valid catalog, got valid=%v errors=%v", res.Valid, res.Errors)
	}

	doc, err := io.NewLoader().Load(catalogPath)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	w := io.NewWriter()

	for _, format := range []io.Format{io.FormatYAML, io.FormatXML} {
		converted, err := w.Marshal(doc, format)
		if err != nil {
			t.Fatalf("Marshal(%s) failed: %v", format, err)
		}
		convRes, err := v.ValidateBytes(converted, format, "converted"+format.Extension())
		if err != nil {
			t.Fatalf("ValidateBytes(%s) errored: %v\nPayload:\n%s", format, err, string(converted))
		}
		if !convRes.Valid {
			t.Fatalf("ValidateBytes(%s) invalid:\n%s\nPayload:\n%s", format, convRes.String(), string(converted))
		}
	}
}

func TestValidatorRejectsInvalidCatalog(t *testing.T) {
	v, err := NewValidator()
	if err != nil {
		t.Fatalf("NewValidator() failed: %v", err)
	}

	invalid := []byte(`{"catalog":{"uuid":"not-a-uuid"}}`)
	res, err := v.ValidateBytes(invalid, io.FormatJSON, "invalid.json")
	if err != nil {
		t.Fatalf("ValidateBytes failed unexpectedly: %v", err)
	}
	if res.Valid || res.ErrorCount() == 0 {
		t.Fatalf("expected invalid catalog to report schema errors, got %+v", res)
	}
}
