package api

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/hackIDLE/fedramp-browser/internal/model"
)

const consolidatedRulesFixture = `{
  "info": {
    "title": "FedRAMP Consolidated Rules for 2026",
    "description": "Structured machine-readable rules",
    "version": "2026.11.02.01",
    "last_updated": "2026-11-02"
  },
  "FRD": {
    "info": {
      "name": "FedRAMP Definitions",
      "short_name": "FRD",
      "web_name": "definitions",
      "purpose": "Establish shared FedRAMP definitions.",
      "status": "stable",
      "effective": {
        "is": "required",
        "current_status": "Consolidated Rules for 2026",
        "date": {
          "obtain": "2026-01-01",
          "maintain": "2026-06-24"
        }
      }
    },
    "data": {
      "all": {
        "FRD-ACV": {
          "term": "Accepted Vulnerability",
          "definition": "A vulnerability accepted by the provider.",
          "alts": ["accepted vulnerability"],
          "notes": ["First note.", "Second note."],
          "reference": "44 U.S. Code § 3502",
          "reference_url": "https://example.gov/ref"
        }
      }
    }
  },
  "FRR": {
    "AFC": {
      "info": {
        "name": "Addressing FedRAMP Communication",
        "short_name": "AFC",
        "web_name": "addressing-fedramp-communication",
        "purpose": "Ensure reliable security contact routing.",
        "status": "stable",
        "effective": {
          "is": "required",
          "current_status": "Consolidated Rules for 2026",
          "date": {
            "obtain": "2026-01-01",
            "maintain": "2026-12-31"
          }
        }
      },
      "data": {
        "all": {
          "FRP": {
            "AFC-FRP-VEM": {
              "name": "Verified Emails",
              "statement": "FedRAMP MUST send messages using an official address.",
              "note": "Official domains only.",
              "force": "MUST",
              "affects": ["FedRAMP"],
              "following_information": ["Additional detail ignored cleanly"]
            }
          }
        }
      }
    },
    "CPO": {
      "info": {
        "name": "Certification Package Overview",
        "short_name": "CPO",
        "web_name": "certification-package-overview",
        "purpose": "Outline package overview expectations.",
        "status": "stable",
        "20x": {
          "effective": {
            "is": "required",
            "current_status": "Consolidated Rules for 2026",
            "date": {
              "obtain": "2026-06-24"
            }
          }
        },
        "rev5": {
          "effective": {
            "is": "optional",
            "current_status": "Transition"
          }
        }
      },
      "data": {
        "20x": {
          "CSO": {
            "CPO-CSO-OVR": {
              "name": "Package Summary",
              "statement": "Providers SHOULD summarize the system.",
              "force": "SHOULD",
              "affects": ["Providers"]
            }
          }
        }
      }
    }
  },
  "KSI": {
    "IAM": {
      "id": "KSI-IAM",
      "name": "Identity and Access Management",
      "short_name": "IAM",
      "status": "stable",
      "indicators": {
        "KSI-IAM-AAM": {
          "name": "Automating Account Management",
          "statement": "Automate account lifecycle management.",
          "controls": ["ac-2", "ia-2"],
          "note": "Supports phishing-resistant MFA."
        }
      }
    }
  }
}`

func newFixtureServer(status int, body string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/"+ConsolidatedFilename {
			http.NotFound(w, r)
			return
		}
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
}

func TestFetchAndParseConsolidatedRules2026(t *testing.T) {
	ts := newFixtureServer(http.StatusOK, consolidatedRulesFixture)
	defer ts.Close()

	client := NewClient(WithBaseURL(ts.URL), WithRefresh(true), WithoutCache())
	data, err := client.FetchConsolidatedDocument()
	if err != nil {
		t.Fatalf("FetchConsolidatedDocument failed: %v", err)
	}

	doc, err := client.ParseConsolidatedDocument(data)
	if err != nil {
		t.Fatalf("ParseConsolidatedDocument failed: %v", err)
	}
	if doc.Info.Version != "2026.11.02.01" {
		t.Fatalf("expected version 2026.11.02.01, got %q", doc.Info.Version)
	}

	docs := client.ParseDocuments(data)
	if len(docs) != 4 {
		t.Fatalf("expected 4 discovered docs (FRD, KSI, AFC, CPO), got %d", len(docs))
	}

	defs, err := client.ParseDefinitions(data)
	if err != nil {
		t.Fatalf("ParseDefinitions failed: %v", err)
	}
	if len(defs) != 1 || defs[0].ID != "FRD-ACV" || defs[0].Term != "Accepted Vulnerability" {
		t.Fatalf("unexpected definitions: %+v", defs)
	}
	if defs[0].Note != "First note. Second note." {
		t.Fatalf("expected joined notes, got %q", defs[0].Note)
	}

	inds, err := client.ParseIndicators(data)
	if err != nil {
		t.Fatalf("ParseIndicators failed: %v", err)
	}
	if len(inds) != 1 || inds[0].ID != "KSI-IAM-AAM" || len(inds[0].Controls) != 2 {
		t.Fatalf("unexpected indicators: %+v", inds)
	}

	afcReqs, err := client.ParseRequirements(data, "AFC")
	if err != nil {
		t.Fatalf("ParseRequirements(AFC) failed: %v", err)
	}
	if len(afcReqs) != 1 || afcReqs[0].ID != "AFC-FRP-VEM" || afcReqs[0].PrimaryKeyWord != "MUST" {
		t.Fatalf("unexpected AFC requirements: %+v", afcReqs)
	}

	cpoReqs, err := client.ParseRequirements(data, "CPO")
	if err != nil {
		t.Fatalf("ParseRequirements(CPO) failed: %v", err)
	}
	if len(cpoReqs) != 1 || cpoReqs[0].PrimaryKeyWord != "SHOULD" {
		t.Fatalf("unexpected CPO requirements: %+v", cpoReqs)
	}

	frdInfo, err := client.ParseDocumentInfo(data, "FRD")
	if err != nil {
		t.Fatalf("ParseDocumentInfo(FRD) failed: %v", err)
	}
	frdDoc := model.Document{Code: "FRD"}
	EnrichDocument(&frdDoc, frdInfo)
	if frdDoc.Purpose == "" || frdDoc.EffectiveInfo["default"].StartDate != "2026-01-01" {
		t.Fatalf("unexpected enriched FRD doc: %+v", frdDoc)
	}

	cpoInfo, err := client.ParseDocumentInfo(data, "CPO")
	if err != nil {
		t.Fatalf("ParseDocumentInfo(CPO) failed: %v", err)
	}
	cpoDoc := model.Document{Code: "CPO"}
	EnrichDocument(&cpoDoc, cpoInfo)
	if cpoDoc.EffectiveInfo["20x"].Is != "required" || cpoDoc.EffectiveInfo["rev5"].Is != "optional" {
		t.Fatalf("unexpected enriched CPO effective map: %+v", cpoDoc.EffectiveInfo)
	}
}

func TestParseLegacyShapesCompatible(t *testing.T) {
	legacy := []byte(`{
	  "FRD": {
	    "info": {
	      "name": "Legacy FRD",
	      "effective": {"20x": {"is": "required", "start_date": "2025-01-01"}},
	      "front_matter": {"purpose": "Legacy purpose"}
	    },
	    "data": {
	      "both": {
	        "FRD-OLD": {"id": "FRD-OLD", "term": "Old", "definition": "Legacy def"}
	      }
	    }
	  },
	  "FRR": {
	    "ADS": {
	      "info": {"name": "ADS"},
	      "data": {
	        "both": {
	          "CSO": {
	            "ADS-1": {"id": "ADS-1", "name": "Req", "statement": "Do it.", "primary_key_word": "MUST"}
	          }
	        }
	      }
	    }
	  }
	}`)

	client := NewClient(WithoutCache())
	defs, err := client.ParseDefinitions(legacy)
	if err != nil || len(defs) != 1 || defs[0].ID != "FRD-OLD" {
		t.Fatalf("legacy defs failed: err=%v defs=%+v", err, defs)
	}
	reqs, err := client.ParseRequirements(legacy, "ADS")
	if err != nil || len(reqs) != 1 || reqs[0].PrimaryKeyWord != "MUST" {
		t.Fatalf("legacy reqs failed: err=%v reqs=%+v", err, reqs)
	}
	info, err := client.ParseDocumentInfo(legacy, "FRD")
	if err != nil {
		t.Fatalf("legacy ParseDocumentInfo failed: %v", err)
	}
	doc := model.Document{Code: "FRD"}
	EnrichDocument(&doc, info)
	if doc.Purpose != "Legacy purpose" || doc.EffectiveInfo["20x"].StartDate != "2025-01-01" {
		t.Fatalf("legacy EnrichDocument failed: %+v", doc)
	}
}

func TestFetchConsolidatedDocumentHTTPError(t *testing.T) {
	ts := newFixtureServer(http.StatusNotFound, "not found")
	defer ts.Close()

	client := NewClient(WithBaseURL(ts.URL), WithRefresh(true), WithoutCache())
	_, err := client.FetchConsolidatedDocument()
	if err == nil || !strings.Contains(err.Error(), "HTTP 404") {
		t.Fatalf("expected HTTP 404 error, got %v", err)
	}
}

func TestLiveFedRAMPRules(t *testing.T) {
	if os.Getenv("FEDRAMP_LIVE_TEST") != "1" {
		t.Skip("set FEDRAMP_LIVE_TEST=1 to run live FedRAMP/rules check")
	}

	client := NewClient(WithRefresh(true), WithoutCache())
	data, err := client.FetchConsolidatedDocument()
	if err != nil {
		t.Fatalf("live FetchConsolidatedDocument failed: %v", err)
	}

	defs, err := client.ParseDefinitions(data)
	if err != nil || len(defs) == 0 {
		t.Fatalf("live ParseDefinitions failed: err=%v count=%d", err, len(defs))
	}

	inds, err := client.ParseIndicators(data)
	if err != nil || len(inds) == 0 {
		t.Fatalf("live ParseIndicators failed: err=%v count=%d", err, len(inds))
	}

	docs := client.ParseDocuments(data)
	totalReqs := 0
	for _, doc := range docs {
		if doc.Code == "FRD" || doc.Code == "KSI" {
			continue
		}
		reqs, err := client.ParseRequirements(data, doc.Code)
		if err != nil {
			t.Fatalf("live ParseRequirements(%s) failed: %v", doc.Code, err)
		}
		totalReqs += len(reqs)
	}
	if totalReqs == 0 {
		t.Fatal("expected non-zero live FRR requirements")
	}
	t.Logf("Live FedRAMP/rules verified: %d docs, %d definitions, %d indicators, %d requirements",
		len(docs), len(defs), len(inds), totalReqs)
}
