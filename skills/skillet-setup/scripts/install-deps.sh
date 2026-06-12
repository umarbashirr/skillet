#!/bin/bash
# Installs system dependencies for the skillet workflow:
#   1. glab — GitLab CLI (https://gitlab.com/gitlab-org/cli)
#   2. gh   — GitHub CLI (https://cli.github.com)
#   3. Atlassian Rovo MCP server (Jira) registered with Claude Code
set -e

# No args = install everything. --glab / --gh / --mcp install only that piece.
DO_GLAB=true; DO_GH=true; DO_MCP=true
if [ $# -gt 0 ]; then
  DO_GLAB=false; DO_GH=false; DO_MCP=false
  for arg in "$@"; do
    case "$arg" in
      --glab) DO_GLAB=true ;;
      --gh)   DO_GH=true ;;
      --mcp)  DO_MCP=true ;;
      *) echo "Unknown flag: $arg (use --glab, --gh and/or --mcp)"; exit 1 ;;
    esac
  done
fi

if $DO_GLAB; then
echo "== glab (GitLab CLI) =="
if command -v glab >/dev/null 2>&1; then
  echo "glab already installed: $(glab --version | head -1)"
else
  if command -v brew >/dev/null 2>&1; then
    brew install glab
  elif command -v apt-get >/dev/null 2>&1 && apt-cache show glab >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y glab
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y glab
  elif command -v snap >/dev/null 2>&1; then
    sudo snap install glab
  else
    echo "No package manager found for glab. Installing latest binary from GitLab releases..."
    ARCH=$(uname -m); case "$ARCH" in x86_64) ARCH=amd64;; aarch64|arm64) ARCH=arm64;; esac
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    VERSION=$(curl -s "https://gitlab.com/api/v4/projects/gitlab-org%2Fcli/releases" | grep -o '"tag_name":"v[^"]*"' | head -1 | cut -d'"' -f4)
    curl -sL "https://gitlab.com/gitlab-org/cli/-/releases/${VERSION}/downloads/glab_${VERSION#v}_${OS}_${ARCH}.tar.gz" | tar -xz -C /tmp
    mkdir -p "$HOME/.local/bin" && mv /tmp/bin/glab "$HOME/.local/bin/glab"
    echo "Installed to ~/.local/bin/glab — ensure it is on PATH."
  fi
  echo "glab installed. Authenticate with: glab auth login"
fi
fi

if $DO_GH; then
echo "== gh (GitHub CLI) =="
if command -v gh >/dev/null 2>&1; then
  echo "gh already installed: $(gh --version | head -1)"
else
  if command -v brew >/dev/null 2>&1; then
    brew install gh
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y gh
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y gh
  elif command -v snap >/dev/null 2>&1; then
    sudo snap install gh
  else
    echo "No package manager found for gh. Installing latest binary from GitHub releases..."
    ARCH=$(uname -m); case "$ARCH" in x86_64) ARCH=amd64;; aarch64|arm64) ARCH=arm64;; esac
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    VERSION=$(curl -s https://api.github.com/repos/cli/cli/releases/latest | grep -o '"tag_name": *"v[^"]*"' | head -1 | cut -d'"' -f4)
    curl -sL "https://github.com/cli/cli/releases/download/${VERSION}/gh_${VERSION#v}_${OS}_${ARCH}.tar.gz" | tar -xz -C /tmp
    mkdir -p "$HOME/.local/bin" && mv "/tmp/gh_${VERSION#v}_${OS}_${ARCH}/bin/gh" "$HOME/.local/bin/gh"
    echo "Installed to ~/.local/bin/gh — ensure it is on PATH."
  fi
  echo "gh installed. Authenticate with: gh auth login"
fi
fi

if $DO_MCP; then
echo "== Atlassian (Jira) MCP server =="
if command -v claude >/dev/null 2>&1; then
  if claude mcp list 2>/dev/null | grep -qi atlassian; then
    echo "Atlassian MCP already registered."
  else
    # SSE endpoint is deprecated (June 2026) — use the HTTP endpoint.
    claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp --scope user
    echo "Atlassian MCP registered. Run /mcp inside Claude Code to complete the OAuth login."
  fi
else
  echo "claude CLI not found — install Claude Code first: npm i -g @anthropic-ai/claude-code"
  exit 1
fi
fi

echo "== Done =="
