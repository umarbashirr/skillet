# skillet 🍳

One command to install the whole XS team agent workflow. Everything is pre-selected — uncheck what you don't want.

```bash
npx skillet-cli
```

```
◆  What to install? (all selected — uncheck to opt out)
│  ◼ grill-me            relentless plan interview, Jira-seedable
│  ◼ grill-with-docs     grilling that maintains CONTEXT.md/ADRs
│  ◼ to-prd              conversation → PRD as Jira subtask
│  ◼ to-issues           PRD → ready-for-agent Jira subtasks
│  ◼ handoff             compact session into handoff doc
│  ◼ ralph-once          single Ralph iteration + loop scripts
│  ◼ jira-ralph          TDD loop over Jira subtasks → draft PR
│  ◼ Atlassian (Jira) MCP server
│  ◼ glab CLI
```

Non-interactive:

```bash
npx skillet-cli --yes                          # everything, defaults
npx skillet-cli --yes --skip glab,handoff      # opt out of items
npx skillet-cli --only grill-me,to-prd --jira-project AB
```

Alternative, skill-driven install (no Node needed):

```bash
npx skills add <owner>/xs-agent-skills@setup-xs-workflow
# then in Claude Code: /setup-xs-workflow
```

## What it installs

Skills (into `~/.claude/skills/` or `./.claude/skills/`):

- **grill-me** — relentless plan interview, seedable from a Jira ticket URL
- **grill-with-docs** — grilling that maintains CONTEXT.md and ADRs inline
- **to-prd** — conversation → PRD, published as a Jira subtask (label `prd`)
- **to-issues** — PRD → tracer-bullet Jira subtasks (label `ready-for-agent`)
- **handoff** — compact the session into a handoff doc for the next agent
- **ralph-once** — single human-in-the-loop Ralph iteration over `PRD.md` (plus `ralph-once.sh` / `afk-ralph.sh`)
- **jira-ralph** — TDD loop over ready-for-agent Jira subtasks, ending in a draft PR

System dependencies:

- **Atlassian (Jira) MCP server** — `claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp`
- **glab** — GitLab CLI

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

`grill-me`, `grill-with-docs`, `to-prd`, `to-issues`, `handoff`, and the Ralph technique are by [Matt Pocock](https://github.com/mattpocock/skills) ([aihero.dev — Getting Started with Ralph](https://www.aihero.dev/getting-started-with-ralph)). Jira adaptations and `jira-ralph` are XS-team additions. See [LICENSE](LICENSE).
