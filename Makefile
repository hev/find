.PHONY: build clean install test vet typecheck check npm-binaries

PREFIX ?= $(HOME)/.local
BINDIR ?= $(PREFIX)/bin
ASK_BIN := $(BINDIR)/ask

build:
	go build -o bin/ask ./cmd/ask

clean:
	rm -rf bin/

# Fast path for iteration: builds and drops the ask binary directly into
# $(BINDIR) so a single zsh hash entry always points at the freshly-built
# file.
install:
	@mkdir -p "$(BINDIR)"
	@GOBIN="$(BINDIR)" go install ./cmd/ask
	@codesign --force --sign - "$(ASK_BIN)" 2>/dev/null || true
	@echo "Installed ask: $(ASK_BIN)"
	@if [ -n "$$ZSH_VERSION" ] || [ "$${SHELL##*/}" = "zsh" ]; then \
		echo "If 'ask' still runs an older binary, run: hash -r"; \
	fi

test:
	go test ./...
	pnpm test

vet:
	go vet ./...

typecheck:
	pnpm typecheck

# The pre-change gauntlet from CLAUDE.md.
check: vet test typecheck
	pnpm --filter hev-ask-site check

# Cross-compile the ask binary into the per-platform npm packages.
npm-binaries:
	pnpm run build:npm-binaries
