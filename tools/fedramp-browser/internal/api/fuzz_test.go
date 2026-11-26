package api

import "testing"

func FuzzParseDefinitions(f *testing.F) {
	f.Add([]byte(`{"FRD":{"data":{"all":{}}}}`))
	f.Add([]byte(`{"FRD":{"data":{"all":{"FRD-TEST":{"term":"Test Term","definition":"A test"}}}}}`))
	f.Add([]byte(`{"FRD":{"data":{"both":{"FRD-TEST":{"term":"Test Term","definition":"A test"}}}}}`))
	f.Add([]byte(`{}`))
	f.Add([]byte(`invalid json`))

	f.Fuzz(func(t *testing.T, data []byte) {
		client := NewClient(WithoutCache())
		_, _ = client.ParseDefinitions(data)
	})
}

func FuzzParseIndicators(f *testing.F) {
	f.Add([]byte(`{"KSI":{}}`))
	f.Add([]byte(`{"KSI":{"IAM":{"id":"KSI-IAM","name":"Test","indicators":{"KSI-IAM-1":{"name":"Ind","controls":["ac-2"]}}}}}`))
	f.Add([]byte(`{"KSI":{"AFR":{"id":"AFR","name":"Test","indicators":[]}}}`))
	f.Add([]byte(`{}`))
	f.Add([]byte(`invalid json`))

	f.Fuzz(func(t *testing.T, data []byte) {
		client := NewClient(WithoutCache())
		_, _ = client.ParseIndicators(data)
	})
}

func FuzzParseRequirements(f *testing.F) {
	f.Add([]byte(`{"FRR":{"AFC":{"data":{}}}}`), "AFC")
	f.Add([]byte(`{"FRR":{"VDR":{"data":{"all":{"CSO":{"VDR-CSO-001":{"statement":"test","force":"MUST"}}}}}}}`), "VDR")
	f.Add([]byte(`{"FRR":{"VDR":{"data":{"both":{"CSO":{"VDR-CSO-001":{"statement":"test","primary_key_word":"MUST"}}}}}}}`), "VDR")
	f.Add([]byte(`{}`), "AFC")
	f.Add([]byte(`invalid json`), "")

	f.Fuzz(func(t *testing.T, data []byte, docCode string) {
		client := NewClient(WithoutCache())
		_, _ = client.ParseRequirements(data, docCode)
	})
}
