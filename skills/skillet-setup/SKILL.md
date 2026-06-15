---
name: skillet-setup
description: Use when setting up the skillet agent workflow in a project — installs the grill-me, grill-with-docs, to-prd, to-issues, handoff, ralph-once, jira-ralph, tdd, prototype, caveman, nextjs-16, and nextjs-playbooks skills for one or more agents (Claude Code, Cursor, VS Code Copilot, Codex, Antigravity), registers the Atlassian (Jira) MCP server in each, installs the gh and glab CLIs, and walks every auth flow to completion. Run once per machine/project; also use when any of those skills are missing or Jira MCP is not connected.
disable-model-invocation: true
---

# Skillet Setup

One-shot installer for the skillet plan→PRD→issues→implement agent workflow. Most of the bundled skills are by Matt Pocock (mattpocock/skills, aihero.dev), adapted for a Jira-based flow.

What gets installed:

| Piece | What it does |
|-------|--------------|
| `grill-me` | Relentless interview to stress-test a plan (optionally seeded from a Jira ticket) |
| `grill-with-docs` | Grilling that updates CONTEXT.md / ADRs inline (optionally seeded from a Jira ticket) |
| `to-prd` | Turn conversation into a PRD, published as Jira subtask (label `prd`) |
| `to-issues` | Break PRD into tracer-bullet Jira subtasks (label `ready-for-agent`) |
| `handoff` | Handoff doc for the next agent + Jira handoff comment and pause markers when story context exists |
| `ralph-once` | One human-in-the-loop TDD Ralph iteration over a Jira story (PRD.md fallback) with stage comments + quality gates (+ `ralph-once.sh`, `afk-ralph.sh`) |
| `jira-ralph` | TDD loop over ready-for-agent Jira subtasks → draft PR |
| `tdd` | Red-green-refactor TDD discipline (vertical slices, behavior-not-implementation tests) |
| `prototype` | Throwaway prototypes — interactive terminal app for logic/state questions, or multiple UI variations on one route |
| `caveman` | Ultra-compressed response mode, ~75% fewer tokens, full technical accuracy |
| `nextjs-16` | Next.js 16 App Router expert knowledge base (SKILL + reference docs) |
| `nextjs-playbooks` | Next.js 16 step-by-step procedures: scaffold-route, cache-components-setup, server-actions-forms, pages-to-app, v16-upgrade |
| Atlassian MCP | Jira access for the skills above, registered per agent |
| `gh` CLI | GitHub CLI for repos hosted on GitHub |
| `glab` CLI | GitLab CLI for repos hosted on GitLab |

## Step 1: Ask configuration

Ask the user:

- **Which agents?** — Claude Code, Cursor, VS Code Copilot, Codex, Antigravity. One or several; pre-select the ones whose config dirs exist (`~/.claude`, `~/.cursor`, `~/.config/Code`, `~/.codex`, `~/.gemini`).
- **Jira domain** (default: `xcelore.atlassian.net`)
- **Jira project key** (default: `XW`)
- Install skills **globally** (`~/.agents/skills/` — available in every project) or **project-local** (`./.agents/skills/`)? Default: global.

## Step 2: Install the skills

Let `DEST` be the chosen skills directory and `BUNDLED` be the `bundled/` directory next to this SKILL.md.

For each of `grill-me`, `grill-with-docs`, `to-prd`, `to-issues`, `handoff`, `ralph-once`, `jira-ralph`, `tdd`, `prototype`, `caveman`, `nextjs-16`, `nextjs-playbooks`:

```bash
mkdir -p "$DEST/<name>"
sed -e 's/{{JIRA_DOMAIN}}/<jira-domain>/g' -e 's/{{JIRA_PROJECT}}/<project-key>/g' \
  "$BUNDLED/<name>/SKILL.md.template" > "$DEST/<name>/SKILL.md"
```

Then copy supporting files verbatim (everything in the bundled skill dir except `SKILL.md.template`):

```bash
cp "$BUNDLED/grill-with-docs/CONTEXT-FORMAT.md" "$BUNDLED/grill-with-docs/ADR-FORMAT.md" "$DEST/grill-with-docs/"
cp "$BUNDLED"/tdd/{deep-modules,interface-design,mocking,refactoring,tests}.md "$DEST/tdd/"
cp "$BUNDLED"/prototype/{LOGIC,UI}.md "$DEST/prototype/"
cp "$BUNDLED"/nextjs-16/{v16-changes,cache-and-rendering,routing-and-data,apis-metadata-assets,config-cli-deploy,doc-map}.md "$DEST/nextjs-16/"
cp "$BUNDLED"/nextjs-playbooks/{scaffold-route,cache-components-setup,server-actions-forms,pages-to-app,v16-upgrade}.md "$DEST/nextjs-playbooks/"
```

Do NOT skip a skill because a directory already exists — show the user a diff and ask overwrite/skip per conflict.

Then symlink each installed skill into every agent the user selected (skills.sh convention). Link `$DEST/<name>` into the agent's skills dir:

| Agent | Skills dir |
|-------|-----------|
| Claude Code | `~/.claude/skills/` |
| Cursor | `~/.cursor/skills/` |
| VS Code Copilot | `~/.copilot/skills/` |
| Codex | `~/.codex/skills/` |
| Antigravity | `~/.gemini/skills/` |

```bash
ln -sfn "$DEST/<name>" "<agent-skills-dir>/<name>"
```

(Project-local install: link into the project-local equivalents, e.g. `./.claude/skills/`.) If the agent dir already holds a REAL directory with that name, ask before replacing it.

## Step 3: Install Ralph scripts into the project

Copy into the project root and make executable:

```bash
cp "$BUNDLED/ralph-once/ralph-once.sh" ./
chmod +x ralph-once.sh
touch progress.txt
```

On Windows also copy the cmd twin — `.sh` only runs under Git Bash there:

```bash
cp "$BUNDLED/ralph-once/ralph-once.cmd" ./
```

`afk-ralph.sh` (autonomous Docker loop) is opt-in — install it ONLY if the user explicitly asks for the AFK loop:

```bash
cp "$BUNDLED/ralph-once/afk-ralph.sh" ./ && chmod +x afk-ralph.sh
```

If the project has a `.gitignore`, do not ignore `progress.txt` — it is meant to be committed.

## Step 4: Install system dependencies

CLIs — run the bundled script (idempotent, safe to re-run): `bash "<this-skill-dir>/scripts/install-deps.sh" --gh --glab`. If it needs `sudo` and cannot get it, tell the user which command to run manually.

Atlassian MCP — register in EACH selected agent:

| Agent | How |
|-------|-----|
| Claude Code | `claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp --scope user` |
| Cursor | merge into `~/.cursor/mcp.json`: `mcpServers.atlassian = {"url": "https://mcp.atlassian.com/v1/mcp"}` |
| VS Code Copilot | merge into `~/.config/Code/User/mcp.json` (mac: `~/Library/Application Support/Code/User/`): `servers.atlassian = {"type": "http", "url": "https://mcp.atlassian.com/v1/mcp"}` |
| Codex | append to `~/.codex/config.toml`: `[mcp_servers.atlassian]` + `url = "https://mcp.atlassian.com/v1/mcp"` |
| Antigravity | merge into `~/.gemini/config/mcp_config.json`: `mcpServers.atlassian = {"command": "npx", "args": ["-y", "mcp-remote", "https://mcp.atlassian.com/v1/sse"]}` |

Merge JSON configs — never clobber existing servers.

## Step 5: Complete EVERY auth flow

Do not declare success with pending auth. For each, verify → guide → re-verify:

1. **gh** — `gh auth status`; if it fails, run `gh auth login` with the user and re-check.
2. **glab** — `glab auth status`; if it fails, run `glab auth login` and re-check (only if project is on GitLab).
3. **Atlassian per agent**:
   - Claude Code: user runs `/mcp` → atlassian → browser OAuth. Verify: `claude mcp list` shows atlassian connected.
   - Codex: `codex mcp login atlassian`. Verify: `codex mcp list`.
   - Cursor / VS Code Copilot / Antigravity: OAuth happens in the IDE (Cursor: Settings → MCP → Login; VS Code: "MCP: List Servers" → start atlassian; Antigravity: first tool use triggers mcp-remote browser OAuth). Walk the user through and ask them to confirm completion.

## Step 6: Post-install checklist (tell the user)

1. Restart agent sessions so the new skills are picked up.
2. Workflow order: `/grill-me <jira-url>` → `/to-prd` → `/to-issues` → `/jira-ralph <STORY-KEY>` (or `/ralph-once <STORY-KEY>` for one-subtask-at-a-time TDD; PRD.md mode when no key). `/handoff` when switching sessions.
3. List anything still pending auth, with the exact command or click-path.

## Verify

```bash
ls "$DEST" | grep -cE 'grill-me|grill-with-docs|to-prd|to-issues|handoff|ralph-once|jira-ralph|tdd|prototype|caveman|nextjs-16|nextjs-playbooks'   # expect 12
grep -L '{{JIRA' "$DEST"/{grill-me,grill-with-docs,to-prd,to-issues,handoff,ralph-once,jira-ralph,tdd,prototype,caveman,nextjs-16,nextjs-playbooks}/SKILL.md # all listed = no leftover placeholders
claude mcp list | grep -i atlassian
command -v glab
```

Report each check's result to the user. If any fails, fix it before declaring success.

## Credits

grill-me, grill-with-docs, to-prd, to-issues, handoff, tdd, prototype, caveman and the Ralph technique are by Matt Pocock — https://github.com/mattpocock/skills and https://www.aihero.dev/getting-started-with-ralph. jira-ralph is a team original inspired by the same.
