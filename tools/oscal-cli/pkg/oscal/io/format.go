// Package io handles OSCAL format detection, loading, and serialization across JSON, YAML, and XML.
package io

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Format identifies a supported OSCAL serialization format.
type Format string

const (
	FormatJSON Format = "json"
	FormatYAML Format = "yaml"
	FormatXML  Format = "xml"
)

// ParseFormat normalizes and validates an output format name.
func ParseFormat(raw string) (Format, error) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "json":
		return FormatJSON, nil
	case "yaml", "yml":
		return FormatYAML, nil
	case "xml":
		return FormatXML, nil
	default:
		return "", fmt.Errorf("unsupported format %q (expected json, yaml, or xml)", raw)
	}
}

// Extension returns the canonical file extension including the leading dot.
func (f Format) Extension() string {
	switch f {
	case FormatJSON:
		return ".json"
	case FormatYAML:
		return ".yaml"
	case FormatXML:
		return ".xml"
	default:
		return ""
	}
}

// DetectFormat determines an OSCAL file's format from its extension or content prefix.
func DetectFormat(path string) (Format, error) {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".json":
		return FormatJSON, nil
	case ".yaml", ".yml":
		return FormatYAML, nil
	case ".xml":
		return FormatXML, nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return DetectFormatFromBytes(data), nil
}

// DetectFormatFromBytes sniffs JSON, XML, or YAML from raw content.
func DetectFormatFromBytes(data []byte) Format {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) > 0 {
		switch trimmed[0] {
		case '{', '[':
			return FormatJSON
		case '<':
			return FormatXML
		}
	}
	return FormatYAML
}
