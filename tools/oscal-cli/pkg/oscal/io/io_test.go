package io

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/ethantroy/oscal-cli/pkg/oscal/model"
)

func TestParseAndDetectFormat(t *testing.T) {
	if f, err := ParseFormat("YAML"); err != nil || f != FormatYAML {
		t.Fatalf("ParseFormat(YAML) = (%v, %v)", f, err)
	}
	if FormatJSON.Extension() != ".json" || FormatYAML.Extension() != ".yaml" || FormatXML.Extension() != ".xml" {
		t.Fatal("unexpected format extension")
	}

	catalogPath := filepath.Join("..", "..", "..", "testdata", "simple-catalog.json")
	f, err := DetectFormat(catalogPath)
	if err != nil || f != FormatJSON {
		t.Fatalf("DetectFormat(simple-catalog.json) = (%v, %v)", f, err)
	}
}

func TestRoundTripConversions(t *testing.T) {
	catalogPath := filepath.Join("..", "..", "..", "testdata", "simple-catalog.json")
	loader := NewLoader()
	writer := NewWriter()

	doc, err := loader.Load(catalogPath)
	if err != nil {
		t.Fatalf("Load(simple-catalog.json) failed: %v", err)
	}
	if doc.Type != model.DocumentTypeCatalog {
		t.Fatalf("expected catalog type, got %q", doc.Type)
	}

	// JSON -> YAML -> Doc
	yamlBytes, err := writer.Marshal(doc, FormatYAML)
	if err != nil {
		t.Fatalf("Marshal(YAML) failed: %v", err)
	}
	fromYAML, err := loader.LoadFromBytes(yamlBytes, FormatYAML)
	if err != nil || fromYAML.Type != model.DocumentTypeCatalog {
		t.Fatalf("LoadFromBytes(YAML) failed: err=%v doc=%+v", err, fromYAML)
	}

	// JSON -> XML -> Doc
	xmlBytes, err := writer.Marshal(doc, FormatXML)
	if err != nil {
		t.Fatalf("Marshal(XML) failed: %v", err)
	}
	if !strings.Contains(string(xmlBytes), `<catalog xmlns="http://csrc.nist.gov/ns/oscal/1.0"`) {
		t.Fatalf("expected OSCAL XML namespace on root element:\n%s", string(xmlBytes))
	}
	fromXML, err := loader.LoadFromBytes(xmlBytes, FormatXML)
	if err != nil || fromXML.Type != model.DocumentTypeCatalog {
		t.Fatalf("LoadFromBytes(XML) failed: err=%v doc=%+v", err, fromXML)
	}
}
