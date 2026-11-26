package api

import "encoding/json"

// TopLevelInfo represents the global info section of the consolidated document
type TopLevelInfo struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Version     string `json:"version"`
	LastUpdated string `json:"last_updated"`
}

// ConsolidatedDocument represents the entire consolidated FedRAMP rules structure
type ConsolidatedDocument struct {
	Info TopLevelInfo               `json:"info"`
	FRD  FRDSection                 `json:"FRD"`
	FRR  map[string]json.RawMessage `json:"FRR"`
	KSI  map[string]ThemeJSON       `json:"KSI"`
}

// FRDSection represents the FedRAMP Definitions section
type FRDSection struct {
	Info DocumentInfo                         `json:"info"`
	Data map[string]map[string]DefinitionJSON `json:"data"`
}

// FRRProcess represents a single FRR rule set (e.g., AFC, VDR, UCM)
type FRRProcess struct {
	Info DocumentInfo                                     `json:"info"`
	Data map[string]map[string]map[string]json.RawMessage `json:"data"`
}

// Data structure: applicability("all"/"both"/"20x"/"rev5") -> subset/label -> id -> requirement

// DocumentInfo represents metadata for a rule set (supports 2026 FedRAMP/rules and legacy shapes)
type DocumentInfo struct {
	Name         string               `json:"name"`
	ShortName    string               `json:"short_name"`
	WebName      string               `json:"web_name"`
	Purpose      string               `json:"purpose"`
	Status       string               `json:"status"`
	RawEffective json.RawMessage      `json:"effective"`
	Effective20x *ScopedEffectiveInfo `json:"20x"`
	EffectiveRv5 *ScopedEffectiveInfo `json:"rev5"`
	Releases     []Release            `json:"releases"`
	FrontMatter  FrontMatter          `json:"front_matter"`
	Labels       map[string]LabelInfo `json:"labels"`
	Subsets      map[string]LabelInfo `json:"subsets"`
}

// ScopedEffectiveInfo wraps version-scoped effective status in 2026 FedRAMP/rules
type ScopedEffectiveInfo struct {
	Effective json.RawMessage `json:"effective"`
}

// EffectiveDate holds consolidated rule effective dates
type EffectiveDate struct {
	Obtain   string `json:"obtain"`
	Maintain string `json:"maintain"`
}

// ParseEffective normalizes both 2026 single-object/scoped effective blocks and legacy maps.
func (d DocumentInfo) ParseEffective() map[string]EffectiveInfo {
	out := make(map[string]EffectiveInfo)

	if len(d.RawEffective) > 0 {
		var single EffectiveInfo
		if err := json.Unmarshal(d.RawEffective, &single); err == nil && (single.Is != "" || single.CurrentStatus != "" || single.StartDate != "" || single.EndDate != "" || single.Date != nil) {
			single.normalizeDates()
			out["default"] = single
		} else {
			var legacy map[string]EffectiveInfo
			if err := json.Unmarshal(d.RawEffective, &legacy); err == nil {
				for k, v := range legacy {
					v.normalizeDates()
					out[k] = v
				}
			}
		}
	}

	if d.Effective20x != nil && len(d.Effective20x.Effective) > 0 {
		var eff EffectiveInfo
		if err := json.Unmarshal(d.Effective20x.Effective, &eff); err == nil {
			eff.normalizeDates()
			out["20x"] = eff
		}
	}

	if d.EffectiveRv5 != nil && len(d.EffectiveRv5.Effective) > 0 {
		var eff EffectiveInfo
		if err := json.Unmarshal(d.EffectiveRv5.Effective, &eff); err == nil {
			eff.normalizeDates()
			out["rev5"] = eff
		}
	}

	return out
}

// LabelInfo describes a label or subset used in an FRR rule set
type LabelInfo struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// EffectiveInfo represents program applicability status
type EffectiveInfo struct {
	Is            string         `json:"is"`
	SignupURL     string         `json:"signup_url"`
	CurrentStatus string         `json:"current_status"`
	StartDate     string         `json:"start_date"`
	EndDate       string         `json:"end_date"`
	Date          *EffectiveDate `json:"date"`
	Comments      []string       `json:"comments"`
	Warnings      []string       `json:"warnings"`
}

func (e *EffectiveInfo) normalizeDates() {
	if e.Date != nil {
		if e.StartDate == "" {
			e.StartDate = e.Date.Obtain
		}
		if e.EndDate == "" {
			e.EndDate = e.Date.Maintain
		}
	}
}

// RelatedRFC represents a related RFC reference
type RelatedRFC struct {
	ID            string `json:"id"`
	URL           string `json:"url"`
	DiscussionURL string `json:"discussion_url"`
	ShortName     string `json:"short_name"`
	FullName      string `json:"full_name"`
	StartDate     string `json:"start_date"`
	EndDate       string `json:"end_date"`
}

// Release represents a document release version
type Release struct {
	ID            string       `json:"id"`
	PublishedDate string       `json:"published_date"`
	Description   string       `json:"description"`
	PublicComment bool         `json:"public_comment"`
	RelatedRFCs   []RelatedRFC `json:"related_rfcs"`
}

// FrontMatter contains authority and purpose information
type FrontMatter struct {
	Authority        []Authority `json:"authority"`
	Purpose          string      `json:"purpose"`
	ExpectedOutcomes []string    `json:"expected_outcomes"`
}

// Authority represents a legal authority reference
type Authority struct {
	Reference     string `json:"reference"`
	ReferenceURL  string `json:"reference_url"`
	Description   string `json:"description"`
	Delegation    string `json:"delegation"`
	DelegationURL string `json:"delegation_url"`
}

// UpdateEntry represents a changelog entry
type UpdateEntry struct {
	Date    string `json:"date"`
	Comment string `json:"comment"`
}

// VariesByLevel holds level-specific requirement/indicator variations
type VariesByLevel struct {
	Low      *LevelVariation `json:"low"`
	Moderate *LevelVariation `json:"moderate"`
	High     *LevelVariation `json:"high"`
}

// LevelVariation represents a level-specific variation of a requirement
type LevelVariation struct {
	Statement      string `json:"statement"`
	PrimaryKeyWord string `json:"primary_key_word"`
	TimeframeType  string `json:"timeframe_type"`
	TimeframeNum   int    `json:"timeframe_num"`
}

// RequirementJSON represents a requirement from FRR sections
type RequirementJSON struct {
	ID                   string             `json:"id"`
	FKA                  string             `json:"fka"`
	Statement            string             `json:"statement"`
	Name                 string             `json:"name"`
	Impact               ImpactJSON         `json:"impact"`
	Affects              []string           `json:"affects"`
	Force                string             `json:"force"`
	PrimaryKeyWord       string             `json:"primary_key_word"`
	Note                 string             `json:"note"`
	Notes                []string           `json:"notes"`
	Terms                []string           `json:"terms"`
	Examples             json.RawMessage    `json:"examples"`
	Danger               string             `json:"danger"`
	Notification         json.RawMessage    `json:"notification"`
	Updated              []UpdateEntry      `json:"updated"`
	VariesByLevel        *VariesByLevel     `json:"varies_by_level"`
	FollowingInformation FollowingInfoField `json:"-"` // Custom unmarshaling
	RawFollowingInfo     json.RawMessage    `json:"following_information"`
}

// FollowingInfoField handles nested RequirementJSON items when present
type FollowingInfoField []RequirementJSON

// UnmarshalFollowingInfo processes following_information when shaped as []RequirementJSON.
func (r *RequirementJSON) UnmarshalFollowingInfo() {
	if len(r.RawFollowingInfo) == 0 {
		return
	}
	var reqs []RequirementJSON
	if err := json.Unmarshal(r.RawFollowingInfo, &reqs); err == nil {
		// Ensure it actually parsed nested requirement objects rather than zero-value structs.
		hasObject := false
		for _, item := range reqs {
			if item.ID != "" || item.Statement != "" || item.Name != "" {
				hasObject = true
				break
			}
		}
		if hasObject {
			r.FollowingInformation = reqs
		}
	}
}

// ImpactJSON represents impact levels
type ImpactJSON struct {
	Low      bool `json:"low"`
	Moderate bool `json:"moderate"`
	High     bool `json:"high"`
}

// DefinitionJSON represents a FedRAMP definition
type DefinitionJSON struct {
	ID           string        `json:"id"`
	FKA          string        `json:"fka"`
	Term         string        `json:"term"`
	Alts         []string      `json:"alts"`
	Definition   string        `json:"definition"`
	Note         string        `json:"note"`
	Notes        []string      `json:"notes"`
	Reference    string        `json:"reference"`
	ReferenceURL string        `json:"reference_url"`
	Updated      []UpdateEntry `json:"updated"`
}

// IndicatorJSON represents a KSI indicator
type IndicatorJSON struct {
	ID            string          `json:"id"`
	FKA           string          `json:"fka"`
	Name          string          `json:"name"`
	Statement     string          `json:"statement"`
	Impact        ImpactJSON      `json:"impact"`
	RawControls   json.RawMessage `json:"controls"`
	Reference     string          `json:"reference"`
	ReferenceURL  string          `json:"reference_url"`
	Note          string          `json:"note"`
	Retired       bool            `json:"retired"`
	Terms         []string        `json:"terms"`
	Updated       []UpdateEntry   `json:"updated"`
	VariesByLevel *VariesByLevel  `json:"varies_by_level"`
}

// ParseControls handles controls that can be []ControlJSON or []string
func (ind *IndicatorJSON) ParseControls() []ControlJSON {
	if ind.RawControls == nil {
		return nil
	}
	var controls []ControlJSON
	if err := json.Unmarshal(ind.RawControls, &controls); err == nil {
		return controls
	}
	var ids []string
	if err := json.Unmarshal(ind.RawControls, &ids); err == nil {
		controls = make([]ControlJSON, len(ids))
		for i, id := range ids {
			controls[i] = ControlJSON{ControlID: id}
		}
		return controls
	}
	return nil
}

// ControlJSON represents an SP 800-53 control reference
type ControlJSON struct {
	ControlID string `json:"control_id"`
	Title     string `json:"title"`
}

// ThemeJSON represents a KSI theme
type ThemeJSON struct {
	ID         string                   `json:"id"`
	Name       string                   `json:"name"`
	ShortName  string                   `json:"short_name"`
	Status     string                   `json:"status"`
	Theme      string                   `json:"theme"`
	Indicators map[string]IndicatorJSON `json:"indicators"`
}

// DocumentMetadata holds basic info about a FedRAMP document
type DocumentMetadata struct {
	Code        string
	Name        string
	Description string
}
