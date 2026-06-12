---
name: skillet-setup
description: Use when setting up the skillet agent workflow in a project — installs the grill-me, grill-with-docs, to-prd, to-issues, handoff, ralph-once, and jira-ralph skills, registers the Atlassian (Jira) MCP server, and installs the glab CLI. Run once per machine/project; also use when any of those skills are missing or Jira MCP is not connected.
disable-model-invocation: true
---

# Skillet Setup

One-shot installer for the skillet plan→PRD→issues→implement agent workflow. Most of the bundled skills are by Matt Pocock (mattpocock/skills, aihero.dev), adapted for a Jira-based flow.

What gets installed:

| Piece | What it does |
|-------|--------------|
| `grill-me` | Relentless interview to stress-test a plan (optionally seeded from a Jira ticket) |
| `grill-with-docs` | Grilling that updates CONTEXT.md / ADRs inline |
| `to-prd` | Turn conversation into a PRD, published as Jira subtask (label `prd`) |
| `to-issues` | Break PRD into tracer-bullet Jira subtasks (label `ready-for-agent`) |
| `handoff` | Compact conversation into handoff doc for the next agent |
| `ralph-once` | One human-in-the-loop Ralph iteration over PRD.md (+ `ralph-once.sh`, `afk-ralph.sh`) |
| `jira-ralph` | TDD loop over ready-for-agent Jira subtasks → draft PR |
| Atlassian MCP | Jira access for the skills above |
| `glab` CLI | GitLab CLI for repos hosted on GitLab |

## Step 1: Ask configuration

Ask the user (one question, two values, with defaults):

- **Jira domain** (default: `xcelore.atlassian.net`)
- **Jira project key** (default: `XW`)

Also ask: install skills **globally** (`~/.claude/skills/` — available in every project) or **project-local** (`./.claude/skills/`)? Default: global.

## Step 2: Install the skills

Let `DEST` be the chosen skills directory and `BUNDLED` be the `bundled/` directory next to this SKILL.md.

For each of `grill-me`, `grill-with-docs`, `to-prd`, `to-issues`, `handoff`, `ralph-once`, `jira-ralph`:

```bash
mkdir -p "$DEST/<name>"
sed -e 's/{{JIRA_DOMAIN}}/<jira-domain>/g' -e 's/{{JIRA_PROJECT}}/<project-key>/g' \
  "$BUNDLED/<name>/SKILL.md.template" > "$DEST/<name>/SKILL.md"
```

Then copy supporting files verbatim:

```bash
cp "$BUNDLED/grill-with-docs/CONTEXT-FORMAT.md" "$BUNDLED/grill-with-docs/ADR-FORMAT.md" "$DEST/grill-with-docs/"
```

Do NOT skip a skill because a directory already exists — show the user a diff and ask overwrite/skip per conflict.

## Step 3: Install Ralph scripts into the project

Copy into the project root and make executable:

```bash
cp "$BUNDLED/ralph-once/ralph-once.sh" "$BUNDLED/ralph-once/afk-ralph.sh" ./
chmod +x ralph-once.sh afk-ralph.sh
touch progress.txt
```

If the project has a `.gitignore`, do not ignore `progress.txt` — it is meant to be committed.

## Step 4: Install system dependencies

Run the bundled script (it is idempotent — safe to re-run):

```bash
bash "<this-skill-dir>/scripts/install-deps.sh"
```

It installs `glab` (brew/apt/dnf/snap/binary fallback) and registers the Atlassian MCP server:

```bash
claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp --scope user
```

If the script needs `sudo` and cannot get it, tell the user which command to run manually.

## Step 5: Post-install checklist (tell the user)

1. Run `/mcp` in Claude Code and complete the Atlassian OAuth login.
2. Run `glab auth login` if the project is on GitLab.
3. Restart the Claude Code session so the new skills are picked up.
4. Workflow order: `/grill-me <jira-url>` → `/to-prd` → `/to-issues` → `/jira-ralph <STORY-KEY>` (or `/ralph-once` for PRD.md-driven work). `/handoff` when switching sessions.

## Verify

```bash
ls "$DEST" | grep -cE 'grill-me|grill-with-docs|to-prd|to-issues|handoff|ralph-once|jira-ralph'   # expect 7
grep -L '{{JIRA' "$DEST"/{grill-me,grill-with-docs,to-prd,to-issues,jira-ralph}/SKILL.md           # all listed = no leftover placeholders
claude mcp list | grep -i atlassian
command -v glab
```

Report each check's result to the user. If any fails, fix it before declaring success.

## Credits

grill-me, grill-with-docs, to-prd, to-issues, handoff and the Ralph technique are by Matt Pocock — https://github.com/mattpocock/skills and https://www.aihero.dev/getting-started-with-ralph. jira-ralph is a team original inspired by the same.
