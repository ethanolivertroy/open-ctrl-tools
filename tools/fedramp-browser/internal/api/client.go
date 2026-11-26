package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/hackIDLE/fedramp-browser/internal/cache"
	"github.com/hackIDLE/fedramp-browser/internal/model"
)

const BaseURL = "https://raw.githubusercontent.com/FedRAMP/rules/main"

// ConsolidatedFilename is the single consolidated FedRAMP rules datafile.
const ConsolidatedFilename = "fedramp-consolidated-rules.json"

// DocumentFiles maps known rule set codes to fallback metadata.
var DocumentFiles = map[string]DocumentMetadata{
	"FRD": {Code: "FRD", Name: "FedRAMP Definitions", Description: "Terms and definitions"},
	"KSI": {Code: "KSI", Name: "Key Security Indicators", Description: "Security indicators with control mappings"},
	"AFC": {Code: "AFC", Name: "Addressing FedRAMP Communication", Description: "Security inbox and communication rules"},
	"AGU": {Code: "AGU", Name: "Agency Use of FedRAMP Certified Cloud Services", Description: "Agency authorization rules"},
	"CCM": {Code: "CCM", Name: "Collaborative Continuous Monitoring", Description: "Continuous monitoring rules"},
	"CDS": {Code: "CDS", Name: "Certification Data Sharing", Description: "Authorization data sharing rules"},
	"CMU": {Code: "CMU", Name: "Cryptographic Module Use", Description: "Cryptographic module rules"},
	"CPO": {Code: "CPO", Name: "Certification Package Overview", Description: "Certification package overview rules"},
	"FRC": {Code: "FRC", Name: "FedRAMP Certification", Description: "FedRAMP certification rules"},
	"IEC": {Code: "IEC", Name: "Incident Evaluation and Communication", Description: "Incident evaluation and communication rules"},
	"IVV": {Code: "IVV", Name: "Independent Verification and Validation", Description: "Independent assessment rules"},
	"MAS": {Code: "MAS", Name: "Minimum Assessment Scope", Description: "Assessment scope rules"},
	"MKT": {Code: "MKT", Name: "Marketplace Listing", Description: "FedRAMP Marketplace listing rules"},
	"REC": {Code: "REC", Name: "FedRAMP Recognition of Independent Assessment Services", Description: "Independent assessment recognition rules"},
	"SCG": {Code: "SCG", Name: "Secure Configuration Guide", Description: "Secure configuration rules"},
	"SCN": {Code: "SCN", Name: "Significant Change Notification", Description: "Change notification rules"},
	"SDR": {Code: "SDR", Name: "Security Decision Record", Description: "Security decision record rules"},
	"VDR": {Code: "VDR", Name: "Vulnerability Detection and Response", Description: "Vulnerability management rules"},
	"VER": {Code: "VER", Name: "Vulnerability Evaluation and Reporting", Description: "Vulnerability reporting rules"},
}

// DocumentOrder defines the default display order of rule sets.
var DocumentOrder = []string{
	"FRD", "KSI",
	"AFC", "AGU", "CCM", "CDS", "CMU", "CPO", "FRC", "IEC", "IVV",
	"MAS", "MKT", "REC", "SCG", "SCN", "SDR", "VDR", "VER",
}

// Client is an HTTP client for fetching FedRAMP rules.
type Client struct {
	httpClient *http.Client
	baseURL    string
	cache      *cache.Cache
	refresh    bool
}

// ClientOption configures the client.
type ClientOption func(*Client)

// WithRefresh forces a fresh fetch, ignoring cached data.
func WithRefresh(refresh bool) ClientOption {
	return func(c *Client) {
		c.refresh = refresh
	}
}

// WithBaseURL overrides the remote base URL (primarily for testing).
func WithBaseURL(baseURL string) ClientOption {
	return func(c *Client) {
		c.baseURL = strings.TrimRight(baseURL, "/")
	}
}

// WithoutCache disables disk cache initialization and reads/writes.
func WithoutCache() ClientOption {
	return func(c *Client) {
		c.cache = nil
	}
}

// NewClient creates a new API client.
func NewClient(opts ...ClientOption) *Client {
	c := &Client{
		httpClient: &http.Client{Timeout: 60 * time.Second},
		baseURL:    BaseURL,
	}

	if cache, err := cache.New(); err == nil {
		c.cache = cache
	}

	for _, opt := range opts {
		opt(c)
	}

	return c
}

// FetchConsolidatedDocument fetches the consolidated FedRAMP rules JSON.
func (c *Client) FetchConsolidatedDocument() ([]byte, error) {
	return c.fetchDocument(ConsolidatedFilename)
}

func (c *Client) fetchDocument(filename string) ([]byte, error) {
	url := c.baseURL + "/" + filename

	if c.cache != nil && !c.refresh {
		if data, ok := c.cache.Get(url); ok {
			return data, nil
		}
	}

	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, resp.Status)
	}

	var data []byte
	buf := make([]byte, 4096)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			data = append(data, buf[:n]...)
		}
		if err != nil {
			break
		}
	}

	if c.cache != nil {
		_ = c.cache.Set(url, data)
	}

	return data, nil
}

// ParseConsolidatedDocument parses the top-level structure of the consolidated file.
func (c *Client) ParseConsolidatedDocument(data []byte) (*ConsolidatedDocument, error) {
	var doc ConsolidatedDocument
	if err := json.Unmarshal(data, &doc); err != nil {
		return nil, fmt.Errorf("parsing consolidated document: %w", err)
	}
	return &doc, nil
}

// ParseDocuments returns document metadata discovered from data (preserving DocumentOrder for known codes).
func (c *Client) ParseDocuments(data []byte) []model.Document {
	var rawDoc map[string]json.RawMessage
	if err := json.Unmarshal(data, &rawDoc); err != nil {
		return GetDocumentMetadata()
	}

	frrCodes := make(map[string]DocumentInfo)
	if frrData, ok := rawDoc["FRR"]; ok {
		var frr map[string]json.RawMessage
		if err := json.Unmarshal(frrData, &frr); err == nil {
			for code, procRaw := range frr {
				var proc struct {
					Info DocumentInfo `json:"info"`
				}
				_ = json.Unmarshal(procRaw, &proc)
				frrCodes[code] = proc.Info
			}
		}
	}

	if len(frrCodes) == 0 {
		return GetDocumentMetadata()
	}

	var docs []model.Document
	seen := make(map[string]bool)

	addDoc := func(code string) {
		if seen[code] {
			return
		}
		if code != "FRD" && code != "KSI" {
			if _, ok := frrCodes[code]; !ok {
				return
			}
		}
		seen[code] = true
		meta, known := DocumentFiles[code]
		doc := model.Document{
			Code:        code,
			Name:        meta.Name,
			Description: meta.Description,
		}
		if !known {
			doc.Name = code
			doc.Description = "FedRAMP rule set"
		}
		if info, ok := frrCodes[code]; ok && info.Name != "" {
			doc.Name = info.Name
			if doc.Description == "" {
				doc.Description = info.Purpose
			}
		}
		docs = append(docs, doc)
	}

	addDoc("FRD")
	addDoc("KSI")
	for _, code := range DocumentOrder {
		addDoc(code)
	}

	var extra []string
	for code := range frrCodes {
		if !seen[code] {
			extra = append(extra, code)
		}
	}
	sort.Strings(extra)
	for _, code := range extra {
		addDoc(code)
	}

	return docs
}

// ParseDefinitions parses the FRD section into Definition models.
func (c *Client) ParseDefinitions(data []byte) ([]model.Definition, error) {
	var doc struct {
		FRD FRDSection `json:"FRD"`
	}
	if err := json.Unmarshal(data, &doc); err != nil {
		return nil, err
	}

	buckets := make([]string, 0, len(doc.FRD.Data))
	for bucket := range doc.FRD.Data {
		buckets = append(buckets, bucket)
	}
	sort.Strings(buckets)

	byID := make(map[string]model.Definition)
	for _, bucket := range buckets {
		for id, d := range doc.FRD.Data[bucket] {
			note := d.Note
			if len(d.Notes) > 0 && note == "" {
				note = strings.Join(d.Notes, " ")
			}

			defID := d.ID
			if defID == "" {
				defID = id
			}

			byID[defID] = model.Definition{
				ID:           defID,
				FKA:          d.FKA,
				Term:         d.Term,
				Alts:         d.Alts,
				Text:         d.Definition,
				Note:         note,
				Reference:    d.Reference,
				ReferenceURL: d.ReferenceURL,
			}
		}
	}

	definitions := make([]model.Definition, 0, len(byID))
	for _, def := range byID {
		definitions = append(definitions, def)
	}

	sort.Slice(definitions, func(i, j int) bool {
		return definitions[i].ID < definitions[j].ID
	})

	return definitions, nil
}

// ParseIndicators parses the KSI section into Indicator models.
func (c *Client) ParseIndicators(data []byte) ([]model.Indicator, error) {
	var rawDoc map[string]json.RawMessage
	if err := json.Unmarshal(data, &rawDoc); err != nil {
		return nil, fmt.Errorf("parsing raw document: %w", err)
	}

	ksiRaw, ok := rawDoc["KSI"]
	if !ok {
		return nil, fmt.Errorf("KSI section not found in document")
	}

	var ksiThemes map[string]ThemeJSON
	if err := json.Unmarshal(ksiRaw, &ksiThemes); err != nil {
		return nil, fmt.Errorf("parsing KSI themes: %w", err)
	}

	var indicators []model.Indicator

	for themeCode, theme := range ksiThemes {
		for indID, ind := range theme.Indicators {
			parsedControls := ind.ParseControls()
			controls := make([]model.Control, len(parsedControls))
			for j, ctrl := range parsedControls {
				controls[j] = model.Control{
					ControlID: ctrl.ControlID,
					Title:     ctrl.Title,
				}
			}

			id := ind.ID
			if id == "" {
				id = indID
			}

			indicators = append(indicators, model.Indicator{
				ID:           id,
				FKA:          ind.FKA,
				ThemeCode:    themeCode,
				ThemeName:    theme.Name,
				ThemeDesc:    theme.Theme,
				Name:         ind.Name,
				Statement:    ind.Statement,
				Impact: model.Impact{
					Low:      ind.Impact.Low,
					Moderate: ind.Impact.Moderate,
					High:     ind.Impact.High,
				},
				Controls:     controls,
				Reference:    ind.Reference,
				ReferenceURL: ind.ReferenceURL,
				Note:         ind.Note,
				Retired:      ind.Retired,
			})
		}
	}

	sort.Slice(indicators, func(i, j int) bool {
		return indicators[i].ID < indicators[j].ID
	})

	return indicators, nil
}

// ParseRequirements parses requirements for a given rule set from the consolidated document.
func (c *Client) ParseRequirements(data []byte, docCode string) ([]model.Requirement, error) {
	var rawDoc map[string]json.RawMessage
	if err := json.Unmarshal(data, &rawDoc); err != nil {
		return nil, err
	}

	frrData, ok := rawDoc["FRR"]
	if !ok {
		return nil, nil
	}

	var frr map[string]json.RawMessage
	if err := json.Unmarshal(frrData, &frr); err != nil {
		return nil, err
	}

	processData, ok := frr[docCode]
	if !ok {
		return nil, nil
	}

	var process FRRProcess
	if err := json.Unmarshal(processData, &process); err != nil {
		return nil, fmt.Errorf("parsing FRR process %s: %w", docCode, err)
	}

	var requirements []model.Requirement

	// Iterate: applicability -> subset/label -> id -> requirement
	for applicability, labels := range process.Data {
		for label, entries := range labels {
			for id, rawReq := range entries {
				var req RequirementJSON
				if err := json.Unmarshal(rawReq, &req); err != nil {
					continue
				}
				req.UnmarshalFollowingInfo()

				reqID := req.ID
				if reqID == "" {
					reqID = id
				}

				keyword := req.PrimaryKeyWord
				if keyword == "" {
					keyword = req.Force
				}

				r := model.Requirement{
					ID:            reqID,
					FKA:           req.FKA,
					DocumentCode:  docCode,
					Category:      label,
					Applicability: applicability,
					Statement:     req.Statement,
					Name:          req.Name,
					Impact: model.Impact{
						Low:      req.Impact.Low,
						Moderate: req.Impact.Moderate,
						High:     req.Impact.High,
					},
					Affects:        req.Affects,
					PrimaryKeyWord: keyword,
					Note:           req.Note,
				}

				if req.VariesByLevel != nil {
					if r.PrimaryKeyWord == "" || r.PrimaryKeyWord == "varies_by_level" {
						if req.VariesByLevel.High != nil && req.VariesByLevel.High.PrimaryKeyWord != "" {
							r.PrimaryKeyWord = req.VariesByLevel.High.PrimaryKeyWord
						} else if req.VariesByLevel.Moderate != nil && req.VariesByLevel.Moderate.PrimaryKeyWord != "" {
							r.PrimaryKeyWord = req.VariesByLevel.Moderate.PrimaryKeyWord
						} else if req.VariesByLevel.Low != nil && req.VariesByLevel.Low.PrimaryKeyWord != "" {
							r.PrimaryKeyWord = req.VariesByLevel.Low.PrimaryKeyWord
						}
					}
				}

				if r.Note == "" && len(req.Notes) > 0 {
					r.Note = strings.Join(req.Notes, " ")
				}

				requirements = append(requirements, r)

				if len(req.FollowingInformation) > 0 {
					requirements = append(requirements, c.extractFollowingRequirements(req.FollowingInformation, docCode, label, applicability)...)
				}
			}
		}
	}

	sort.Slice(requirements, func(i, j int) bool {
		return requirements[i].ID < requirements[j].ID
	})

	return requirements, nil
}

func (c *Client) extractFollowingRequirements(reqs []RequirementJSON, docCode, category, applicability string) []model.Requirement {
	var requirements []model.Requirement

	for i := range reqs {
		r := &reqs[i]
		r.UnmarshalFollowingInfo()

		keyword := r.PrimaryKeyWord
		if keyword == "" {
			keyword = r.Force
		}

		req := model.Requirement{
			ID:            r.ID,
			FKA:           r.FKA,
			DocumentCode:  docCode,
			Category:      category,
			Applicability: applicability,
			Statement:     r.Statement,
			Name:          r.Name,
			Impact: model.Impact{
				Low:      r.Impact.Low,
				Moderate: r.Impact.Moderate,
				High:     r.Impact.High,
			},
			Affects:        r.Affects,
			PrimaryKeyWord: keyword,
			Note:           r.Note,
		}
		requirements = append(requirements, req)

		if len(r.FollowingInformation) > 0 {
			requirements = append(requirements, c.extractFollowingRequirements(r.FollowingInformation, docCode, category, applicability)...)
		}
	}

	return requirements
}

// GetDocumentMetadata returns fallback metadata for known documents.
func GetDocumentMetadata() []model.Document {
	docs := make([]model.Document, 0, len(DocumentOrder))
	for _, code := range DocumentOrder {
		meta := DocumentFiles[code]
		docs = append(docs, model.Document{
			Code:        meta.Code,
			Name:        meta.Name,
			Description: meta.Description,
		})
	}
	return docs
}

// ParseDocumentInfo extracts the info section for a specific document.
func (c *Client) ParseDocumentInfo(data []byte, docCode string) (*DocumentInfo, error) {
	switch docCode {
	case "FRD":
		var doc struct {
			FRD struct {
				Info DocumentInfo `json:"info"`
			} `json:"FRD"`
		}
		if err := json.Unmarshal(data, &doc); err != nil {
			return nil, err
		}
		return &doc.FRD.Info, nil
	default:
		var rawDoc map[string]json.RawMessage
		if err := json.Unmarshal(data, &rawDoc); err != nil {
			return nil, err
		}
		frrData, ok := rawDoc["FRR"]
		if !ok {
			return nil, fmt.Errorf("FRR section not found")
		}
		var frr map[string]json.RawMessage
		if err := json.Unmarshal(frrData, &frr); err != nil {
			return nil, err
		}
		processData, ok := frr[docCode]
		if !ok {
			return nil, fmt.Errorf("process %s not found in FRR", docCode)
		}
		var process struct {
			Info DocumentInfo `json:"info"`
		}
		if err := json.Unmarshal(processData, &process); err != nil {
			return nil, err
		}
		return &process.Info, nil
	}
}

// EnrichDocument populates a Document with info from the JSON.
func EnrichDocument(doc *model.Document, info *DocumentInfo) {
	if info == nil {
		return
	}

	if info.Name != "" {
		doc.Name = info.Name
	}

	doc.Purpose = info.Purpose
	if doc.Purpose == "" {
		doc.Purpose = info.FrontMatter.Purpose
	}
	doc.ExpectedOutcomes = info.FrontMatter.ExpectedOutcomes

	for _, auth := range info.FrontMatter.Authority {
		doc.Authority = append(doc.Authority, model.Authority{
			Reference:    auth.Reference,
			ReferenceURL: auth.ReferenceURL,
			Description:  auth.Description,
		})
	}

	for _, rel := range info.Releases {
		doc.Releases = append(doc.Releases, model.Release{
			ID:            rel.ID,
			PublishedDate: rel.PublishedDate,
			Description:   rel.Description,
		})
	}

	effectiveMap := info.ParseEffective()
	if len(effectiveMap) > 0 {
		doc.EffectiveInfo = make(map[string]model.EffectiveStatus, len(effectiveMap))
		for version, eff := range effectiveMap {
			doc.EffectiveInfo[version] = model.EffectiveStatus{
				Is:            eff.Is,
				CurrentStatus: eff.CurrentStatus,
				StartDate:     eff.StartDate,
				EndDate:       eff.EndDate,
				SignupURL:     eff.SignupURL,
				Comments:      eff.Comments,
			}
		}
	}
}
