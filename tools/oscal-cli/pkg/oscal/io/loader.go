package io

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/ethantroy/oscal-cli/pkg/oscal/model"
	"gopkg.in/yaml.v3"
)

// Loader reads OSCAL documents from JSON, YAML, or XML sources.
type Loader struct{}

// NewLoader constructs a Loader.
func NewLoader() *Loader {
	return &Loader{}
}

// Load reads and parses an OSCAL document file, auto-detecting its format.
func (l *Loader) Load(path string) (*model.Document, error) {
	format, err := DetectFormat(path)
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return l.LoadFromBytes(data, format)
}

// LoadFromBytes parses OSCAL document bytes encoded in the specified format.
func (l *Loader) LoadFromBytes(data []byte, format Format) (*model.Document, error) {
	var raw map[string]any

	switch format {
	case FormatJSON:
		if err := json.Unmarshal(data, &raw); err != nil {
			return nil, fmt.Errorf("failed to parse JSON: %w", err)
		}
	case FormatYAML:
		var parsed any
		if err := yaml.Unmarshal(data, &parsed); err != nil {
			return nil, fmt.Errorf("failed to parse YAML: %w", err)
		}
		normalized := normalizeYAML(parsed)
		obj, ok := normalized.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("YAML root must be a mapping")
		}
		raw = obj
	case FormatXML:
		decoded, err := decodeXMLDocument(data)
		if err != nil {
			return nil, fmt.Errorf("failed to parse XML: %w", err)
		}
		raw = decoded
	default:
		return nil, fmt.Errorf("unsupported format: %s", format)
	}

	docType, err := model.DetectDocumentType(raw)
	if err != nil {
		return nil, err
	}

	return &model.Document{
		Type: docType,
		Data: raw,
	}, nil
}

func normalizeYAML(v any) any {
	switch val := v.(type) {
	case map[string]any:
		out := make(map[string]any, len(val))
		for k, item := range val {
			out[k] = normalizeYAML(item)
		}
		return out
	case map[any]any:
		out := make(map[string]any, len(val))
		for k, item := range val {
			out[fmt.Sprintf("%v", k)] = normalizeYAML(item)
		}
		return out
	case []any:
		out := make([]any, len(val))
		for i, item := range val {
			out[i] = normalizeYAML(item)
		}
		return out
	default:
		return val
	}
}
