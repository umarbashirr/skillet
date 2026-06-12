# skillet 🍳

One command to install the whole skillet agent workflow. Everything is pre-selected — uncheck what you don't want.

```bash
npx github:umarbashirr/skillet
```

```
◆  Which skills to install? (all selected — uncheck to opt out)
│  ◼ grill-me            relentless plan interview, Jira-seedable
│  ◼ grill-with-docs     grilling that maintains CONTEXT.md/ADRs, Jira-seedable
│  ◼ to-prd              conversation → PRD as Jira subtask
│  ◼ to-issues           PRD → ready-for-agent Jira subtasks
│  ◼ handoff             handoff doc + Jira handoff comments
│  ◼ ralph-once          single Jira TDD Ralph iteration + loop scripts
│  ◼ jira-ralph          TDD loop over Jira subtasks → draft PR

◆  Which integrations/CLIs to install? (uncheck to opt out)
│  ◼ Atlassian (Jira) MCP server
│  ◼ gh CLI
│  ◼ glab CLI
│  ◻ afk-ralph.sh        autonomous Docker loop — opt-in, unchecked by default

◆  Which agents to install for? (detected ones pre-selected)
│  ◼ Claude Code    ◼ Cursor    ◼ VS Code Copilot    ◼ Codex    ◼ Antigravity
```

The installer finishes every flow: skills are symlinked into each selected agent, the Atlassian MCP server is registered in each agent's own config format, `gh`/`glab` are installed — and each auth flow (`gh auth login`, `glab auth login`, Atlassian OAuth per agent) is run or walked through and verified before the installer declares success. Anything left pending is listed at the end.

Non-interactive:

```bash
npx github:umarbashirr/skillet --yes                          # everything, all detected agents
npx github:umarbashirr/skillet --yes --skip glab,handoff      # opt out of items
npx github:umarbashirr/skillet --only grill-me,to-prd --jira-project AB
npx github:umarbashirr/skillet --yes --agents claude,cursor   # target specific agents
```

(`--yes` cannot run interactive auth — pending auth steps are printed at the end.)

Alternative, skill-driven install (no Node needed):

```bash
npx skills add umarbashirr/skillet@skillet-setup
# then in Claude Code: /skillet-setup
```

## What it installs

Skills — canonical copy in `~/.agents/skills/` (or `./.agents/skills/` with `--dest project`), symlinked into every SELECTED agent (skills.sh convention):

- **grill-me** — relentless plan interview, seedable from a Jira ticket URL
- **grill-with-docs** — grilling that maintains CONTEXT.md and ADRs inline, seedable from a Jira ticket URL
- **to-prd** — conversation → PRD, published as a Jira subtask (label `prd`); posts the full Q&A conversation record as a comment on the story
- **to-issues** — PRD → tracer-bullet Jira subtasks (label `ready-for-agent`)
- **handoff** — compact the session into a handoff doc for the next agent; with story context, also posts a handoff comment on the story and a pause marker on the in-flight subtask
- **ralph-once** — single human-in-the-loop TDD iteration over a Jira story: PO test cases → failing tests → commit → implement → commit → lint/format/typecheck/build, Jira comment per stage, draft PR when the last subtask is done (`PRD.md` fallback; plus `ralph-once.sh`; `afk-ralph.sh` autonomous loop is opt-in: `--only afk-ralph` or check it in the menu)
- **jira-ralph** — TDD loop over ready-for-agent Jira subtasks, ending in a draft PR

System dependencies:

- **Atlassian (Jira) MCP server** — registered per selected agent:
  | Agent | Where | Shape |
  |-------|-------|-------|
  | Claude Code | `claude mcp add --transport http atlassian … --scope user` | HTTP, OAuth via `/mcp` |
  | Cursor | `~/.cursor/mcp.json` | `mcpServers.atlassian.url`, OAuth in IDE |
  | VS Code Copilot | `~/.config/Code/User/mcp.json` | `servers.atlassian` (type http), OAuth in IDE |
  | Codex | `~/.codex/config.toml` | `[mcp_servers.atlassian]`, `codex mcp login atlassian` |
  | Antigravity | `~/.gemini/config/mcp_config.json` | `mcp-remote` wrapper, OAuth on first use |
- **gh** — GitHub CLI (+ `gh auth login` flow)
- **glab** — GitLab CLI (+ `glab auth login` flow)

The installer asks for your Jira domain and project key and bakes them into the skills (defaults: `xcelore.atlassian.net` / `XW`).

## Workflow

```
/grill-me <jira-story-url>   stress-test the plan
/to-prd                      publish PRD subtask
/to-issues                   break into ready-for-agent subtasks
/jira-ralph XW-123           TDD-implement them → draft PR
/handoff                     hand the session to the next agent
```

## Credits

`grill-me`, `grill-with-docs`, `to-prd`, `to-issues`, `handoff`, and the Ralph technique are by [Matt Pocock](https://github.com/mattpocock/skills) ([aihero.dev — Getting Started with Ralph](https://www.aihero.dev/getting-started-with-ralph)). Jira adaptations and `jira-ralph` are our own additions. See [LICENSE](LICENSE).
