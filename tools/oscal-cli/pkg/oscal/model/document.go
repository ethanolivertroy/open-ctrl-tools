// Package model defines core OSCAL document types and root-element detection.
package model

import "fmt"

// DocumentType identifies an OSCAL model root type.
type DocumentType string

const (
	DocumentTypeCatalog             DocumentType = "catalog"
	DocumentTypeProfile             DocumentType = "profile"
	DocumentTypeSSP                 DocumentType = "system-security-plan"
	DocumentTypeComponentDefinition DocumentType = "component-definition"
	DocumentTypeAssessmentPlan      DocumentType = "assessment-plan"
	DocumentTypeAssessmentResults   DocumentType = "assessment-results"
	DocumentTypePOAM                DocumentType = "plan-of-action-and-milestones"
)

var rootKeyToType = map[string]DocumentType{
	"catalog":                       DocumentTypeCatalog,
	"profile":                       DocumentTypeProfile,
	"system-security-plan":          DocumentTypeSSP,
	"component-definition":          DocumentTypeComponentDefinition,
	"assessment-plan":               DocumentTypeAssessmentPlan,
	"assessment-results":            DocumentTypeAssessmentResults,
	"plan-of-action-and-milestones": DocumentTypePOAM,
}

// Document represents a parsed OSCAL document wrapper keyed by its root model name.
type Document struct {
	Type DocumentType
	Data map[string]any
}

// DetectDocumentType determines the OSCAL document type from a decoded document object.
func DetectDocumentType(data map[string]any) (DocumentType, error) {
	if data == nil {
		return "", fmt.Errorf("empty OSCAL document")
	}
	for rootKey, docType := range rootKeyToType {
		if _, ok := data[rootKey]; ok {
			return docType, nil
		}
	}
	return "", fmt.Errorf("unrecognized OSCAL root element")
}
