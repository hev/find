package ask

import (
	"regexp"
	"strconv"
	"strings"
)

type FrontmatterDocument struct {
	Data map[string]any
	Body string
}

func ParseFrontmatter(src string) FrontmatterDocument {
	if !strings.HasPrefix(src, "---") {
		return FrontmatterDocument{Data: map[string]any{}, Body: src}
	}
	end := strings.Index(src[3:], "\n---")
	if end == -1 {
		return FrontmatterDocument{Data: map[string]any{}, Body: src}
	}
	end += 3
	raw := strings.TrimSpace(src[3:end])
	body := src[end:]
	body = regexpFrontmatterEnd.ReplaceAllString(body, "")
	return FrontmatterDocument{Data: parseFlatYAML(raw), Body: body}
}

var (
	regexpFrontmatterEnd = regexp.MustCompile(`^\n---\s*\r?\n?`)
	regexpNumber         = regexp.MustCompile(`^-?\d+(\.\d+)?$`)
)

func parseFlatYAML(src string) map[string]any {
	data := map[string]any{}
	for _, line := range splitLines(src) {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		colon := strings.Index(trimmed, ":")
		if colon == -1 {
			continue
		}
		key := strings.TrimSpace(trimmed[:colon])
		raw := strings.TrimSpace(trimmed[colon+1:])
		if key == "" {
			continue
		}
		data[key] = parseScalar(raw)
	}
	return data
}

func parseScalar(value string) any {
	if value == "" {
		return ""
	}
	if len(value) >= 2 {
		if (strings.HasPrefix(value, `"`) && strings.HasSuffix(value, `"`)) ||
			(strings.HasPrefix(value, `'`) && strings.HasSuffix(value, `'`)) {
			return value[1 : len(value)-1]
		}
	}
	if value == "true" {
		return true
	}
	if value == "false" {
		return false
	}
	if regexpNumber.MatchString(value) {
		if number, err := strconv.ParseFloat(value, 64); err == nil {
			return number
		}
	}
	return value
}
