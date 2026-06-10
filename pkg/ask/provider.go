package ask

import (
	"fmt"
	"strings"
)

// Provider describes an inference provider the digest builder can run against.
// Anthropic speaks its native Messages API; the others share the OpenAI
// Chat Completions dialect and differ only in base URL and key env var.
// Mirrors packages/ui/src/providers.ts.
type Provider struct {
	Name string
	// Label is the human name used in error messages, e.g. "OpenRouter".
	Label string
	// EnvKey is the environment variable the API key is read from.
	EnvKey string
	// BaseURL is the OpenAI-compatible API base; empty for Anthropic.
	BaseURL string
	// DefaultDigestModel is used when --digest-model is not set.
	DefaultDigestModel string
}

var providers = map[string]Provider{
	"anthropic": {
		Name:               "anthropic",
		Label:              "Anthropic",
		EnvKey:             "ANTHROPIC_API_KEY",
		DefaultDigestModel: defaultDigestModel,
	},
	"openai": {
		Name:               "openai",
		Label:              "OpenAI",
		EnvKey:             "OPENAI_API_KEY",
		BaseURL:            "https://api.openai.com/v1",
		DefaultDigestModel: "gpt-5.1",
	},
	"openrouter": {
		Name:               "openrouter",
		Label:              "OpenRouter",
		EnvKey:             "OPENROUTER_API_KEY",
		BaseURL:            "https://openrouter.ai/api/v1",
		DefaultDigestModel: "anthropic/claude-opus-4.8",
	},
}

// ResolveProvider validates a provider name; empty defaults to Anthropic.
func ResolveProvider(name string) (Provider, error) {
	if name == "" {
		name = "anthropic"
	}
	provider, ok := providers[strings.ToLower(name)]
	if !ok {
		return Provider{}, fmt.Errorf("unknown provider %q (expected anthropic, openai, or openrouter)", name)
	}
	return provider, nil
}
