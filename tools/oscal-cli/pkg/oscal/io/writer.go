package io

import (
	"encoding/json"
	"fmt"
	std_io "io"
	"os"

	"github.com/ethantroy/oscal-cli/pkg/oscal/model"
	"gopkg.in/yaml.v3"
)

// Writer serializes OSCAL documents into JSON, YAML, or XML.
type Writer struct{}

// NewWriter constructs a Writer.
func NewWriter() *Writer {
	return &Writer{}
}

// Marshal encodes doc into the requested OSCAL format.
func (w *Writer) Marshal(doc *model.Document, format Format) ([]byte, error) {
	if doc == nil || doc.Data == nil {
		return nil, fmt.Errorf("cannot marshal empty document")
	}

	switch format {
	case FormatJSON:
		out, err := json.MarshalIndent(doc.Data, "", "  ")
		if err != nil {
			return nil, err
		}
		return append(out, '\n'), nil
	case FormatYAML:
		return yaml.Marshal(doc.Data)
	case FormatXML:
		return encodeXMLDocument(doc.Data)
	default:
		return nil, fmt.Errorf("unsupported output format: %s", format)
	}
}

// WriteTo writes the encoded document to w.
func (w *Writer) WriteTo(doc *model.Document, out std_io.Writer, format Format) error {
	payload, err := w.Marshal(doc, format)
	if err != nil {
		return err
	}
	_, err = out.Write(payload)
	return err
}

// Write serializes doc to a filesystem path.
func (w *Writer) Write(doc *model.Document, path string, format Format) error {
	payload, err := w.Marshal(doc, format)
	if err != nil {
		return err
	}
	return os.WriteFile(path, payload, 0644)
}
