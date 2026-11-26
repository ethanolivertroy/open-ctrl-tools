package io

import (
	"bytes"
	"encoding/xml"
	"fmt"
	std_io "io"
	"sort"
	"strings"
)

const oscalNamespace = "http://csrc.nist.gov/ns/oscal/1.0"

var pluralToSingular = map[string]string{
	"activities":          "activity",
	"additions":           "addition",
	"addresses":           "address",
	"annotations":         "annotation",
	"back-matter":         "back-matter",
	"capabilities":        "capability",
	"components":          "component",
	"controls":            "control",
	"document-ids":        "document-id",
	"email-addresses":     "email-address",
	"findings":            "finding",
	"groups":              "group",
	"guidelines":          "guideline",
	"hashes":              "hash",
	"imports":             "import",
	"inventory-items":     "inventory-item",
	"links":               "link",
	"locations":           "location",
	"observations":        "observation",
	"origins":             "origin",
	"params":              "param",
	"parties":             "party",
	"parts":               "part",
	"poam-items":          "poam-item",
	"props":               "prop",
	"resources":           "resource",
	"responsible-parties": "responsible-party",
	"responsible-roles":   "responsible-role",
	"results":             "result",
	"risks":               "risk",
	"rlinks":              "rlink",
	"roles":               "role",
	"subjects":            "subject",
	"telephone-numbers":   "telephone-number",
	"users":               "user",
	"values":              "value",
}

var singularToPlural = func() map[string]string {
	inv := make(map[string]string, len(pluralToSingular))
	for plural, singular := range pluralToSingular {
		if plural != singular {
			inv[singular] = plural
		}
	}
	return inv
}()

func isXMLAttributeKey(parentTag, key string) bool {
	switch key {
	case "uuid", "id", "ns", "class", "href", "rel", "media-type", "algorithm", "system", "type", "how-many", "control-id", "param-id", "source", "parent-id":
		return true
	case "name":
		// In OSCAL XML, `part`, `prop`, etc. carry `name` as an attribute, while `party` has a child `<name>`.
		return parentTag != "party"
	default:
		return false
	}
}

func encodeXMLDocument(data map[string]any) ([]byte, error) {
	if len(data) != 1 {
		return nil, fmt.Errorf("OSCAL XML encoding requires a single root model key, got %d", len(data))
	}

	var rootName string
	var rootVal any
	for k, v := range data {
		rootName = k
		rootVal = v
	}

	var buf bytes.Buffer
	buf.WriteString(xml.Header)
	if err := writeXMLElement(&buf, rootName, rootVal, 0, true); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func writeXMLElement(buf *bytes.Buffer, tag string, val any, depth int, isRoot bool) error {
	indent := strings.Repeat("  ", depth)
	buf.WriteString(indent)
	buf.WriteByte('<')
	buf.WriteString(tag)
	if isRoot {
		buf.WriteString(` xmlns="`)
		buf.WriteString(oscalNamespace)
		buf.WriteByte('"')
	}

	obj, isMap := val.(map[string]any)
	if !isMap {
		buf.WriteByte('>')
		_ = xml.EscapeText(buf, []byte(fmt.Sprintf("%v", val)))
		buf.WriteString("</")
		buf.WriteString(tag)
		buf.WriteString(">\n")
		return nil
	}

	keys := make([]string, 0, len(obj))
	for k := range obj {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var children []string
	for _, k := range keys {
		v := obj[k]
		if v == nil {
			continue
		}
		if isXMLAttributeKey(tag, k) {
			switch typed := v.(type) {
			case string, float64, int, bool:
				buf.WriteByte(' ')
				buf.WriteString(k)
				buf.WriteString(`="`)
				_ = xml.EscapeText(buf, []byte(fmt.Sprintf("%v", typed)))
				buf.WriteByte('"')
				continue
			}
		}
		children = append(children, k)
	}

	if len(children) == 0 {
		buf.WriteString("/>\n")
		return nil
	}

	buf.WriteString(">\n")
	for _, k := range children {
		v := obj[k]
		if k == "prose" {
			text := fmt.Sprintf("%v", v)
			for _, para := range strings.Split(text, "\n\n") {
				paraIndent := strings.Repeat("  ", depth+1)
				buf.WriteString(paraIndent)
				buf.WriteString("<p>")
				_ = xml.EscapeText(buf, []byte(para))
				buf.WriteString("</p>\n")
			}
			continue
		}

		if arr, ok := v.([]any); ok {
			childTag := k
			if singular, mapped := pluralToSingular[k]; mapped {
				childTag = singular
			}
			for _, item := range arr {
				if err := writeXMLElement(buf, childTag, item, depth+1, false); err != nil {
					return err
				}
			}
			continue
		}

		if err := writeXMLElement(buf, k, v, depth+1, false); err != nil {
			return err
		}
	}

	buf.WriteString(indent)
	buf.WriteString("</")
	buf.WriteString(tag)
	buf.WriteString(">\n")
	return nil
}

type xmlNode struct {
	name     string
	attrs    []xml.Attr
	children []*xmlNode
	text     strings.Builder
}

func decodeXMLDocument(data []byte) (map[string]any, error) {
	dec := xml.NewDecoder(bytes.NewReader(data))
	var stack []*xmlNode
	var root *xmlNode

	for {
		tok, err := dec.Token()
		if err == std_io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}

		switch t := tok.(type) {
		case xml.StartElement:
			node := &xmlNode{
				name:  t.Name.Local,
				attrs: append([]xml.Attr(nil), t.Attr...),
			}
			if len(stack) > 0 {
				parent := stack[len(stack)-1]
				parent.children = append(parent.children, node)
			}
			stack = append(stack, node)
		case xml.CharData:
			if len(stack) > 0 {
				stack[len(stack)-1].text.Write(t)
			}
		case xml.EndElement:
			if len(stack) == 0 {
				return nil, fmt.Errorf("unexpected closing XML element </%s>", t.Name.Local)
			}
			done := stack[len(stack)-1]
			stack = stack[:len(stack)-1]
			if len(stack) == 0 {
				root = done
			}
		}
	}

	if root == nil {
		return nil, fmt.Errorf("no root XML element found")
	}

	return map[string]any{
		root.name: nodeToValue(root),
	}, nil
}

func nodeToValue(node *xmlNode) any {
	hasAttrs := false
	for _, a := range node.attrs {
		if a.Name.Local == "xmlns" || a.Name.Space == "xmlns" {
			continue
		}
		hasAttrs = true
		break
	}

	trimmedText := strings.TrimSpace(node.text.String())
	if !hasAttrs && len(node.children) == 0 {
		return trimmedText
	}

	// Elements whose children are solely <p> blocks (outside `part`) decode to prose strings.
	if !hasAttrs && node.name != "part" && len(node.children) > 0 && allChildrenNamed(node.children, "p") {
		paras := make([]string, 0, len(node.children))
		for _, ch := range node.children {
			paras = append(paras, strings.TrimSpace(ch.text.String()))
		}
		return strings.Join(paras, "\n\n")
	}

	obj := make(map[string]any)
	for _, a := range node.attrs {
		if a.Name.Local == "xmlns" || a.Name.Space == "xmlns" {
			continue
		}
		obj[a.Name.Local] = a.Value
	}

	var paragraphs []string
	childCounts := make(map[string]int, len(node.children))
	for _, ch := range node.children {
		childCounts[ch.name]++
	}

	for _, ch := range node.children {
		if ch.name == "p" {
			paragraphs = append(paragraphs, strings.TrimSpace(ch.text.String()))
			continue
		}

		val := nodeToValue(ch)
		if plural, ok := singularToPlural[ch.name]; ok {
			existing, _ := obj[plural].([]any)
			obj[plural] = append(existing, val)
			continue
		}

		if childCounts[ch.name] > 1 {
			existing, _ := obj[ch.name].([]any)
			obj[ch.name] = append(existing, val)
			continue
		}

		obj[ch.name] = val
	}

	if len(paragraphs) > 0 {
		obj["prose"] = strings.Join(paragraphs, "\n\n")
	}
	if trimmedText != "" && len(node.children) == 0 {
		obj["value"] = trimmedText
	}

	return obj
}

func allChildrenNamed(children []*xmlNode, name string) bool {
	for _, ch := range children {
		if ch.name != name {
			return false
		}
	}
	return true
}
