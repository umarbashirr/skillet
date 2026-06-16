# skillet 🍳

One command to install the skillet agent workflow. A recommended set is pre-selected — check anything else you want.

```bash
npx github:umarbashirr/skillet
```

```
◆  Which skills to install? (recommended set pre-selected — check more or uncheck)
│  ◼ grill-me            relentless plan interview, Jira-seedable
│  ◻ grill-with-docs     grilling that maintains CONTEXT.md/ADRs, Jira-seedable
│  ◼ to-prd              conversation → PRD as Jira subtask
│  ◼ to-issues           PRD → ready-for-agent Jira subtasks
│  ◻ handoff             handoff doc + Jira handoff comments
│  ◻ ralph-once          single Jira TDD Ralph iteration + loop scripts
│  ◼ jira-ralph          TDD loop over Jira subtasks → draft PR
│  ◼ tdd                 red-green-refactor TDD discipline
│  ◻ prototype           throwaway prototypes — terminal logic or UI variations
│  ◻ caveman             ultra-compressed responses, ~75% fewer tokens
│  ◻ nextjs-16           Next.js 16 App Router expert knowledge base
│  ◻ nextjs-playbooks    Next.js 16 build/migrate step-by-step procedures
│  ◻ husky-setup         /husky-setup skill — scaffold git hooks in a JS project
│  ◻ frontend-design     distinctive, intentional UI/visual design — Anthropic
│  ◻ vercel-react-best-practices  React/Next.js performance rules — Vercel
│  ◻ web-design-guidelines        audit UI against Web Interface Guidelines — Vercel
│  ◻ agent-browser       browser automation CLI for agents — Vercel Labs
│  ◻ spring-boot         Spring Boot expert — auto-config, REST, DI, Actuator
│  ◻ jpa-hibernate       JPA/Hibernate + Spring Data — mapping, queries, N+1, tx
│  ◻ java-build          Java build — Maven & Gradle, deps, plugins, CI
│  ◻ junit-testing       Java testing — JUnit 5, Mockito, Spring Boot Test

◆  Which integrations/CLIs to install? (uncheck to opt out)
│  ◼ Atlassian (Jira) MCP server
│  ◻ gh CLI              opt-in, unchecked by default
│  ◼ glab CLI
│  ◻ husky git hooks     scaffold hooks into THIS project (JS only) — opt-in
│  ◻ afk-ralph.sh        autonomous Docker loop — opt-in, unchecked by default

◆  Which agents to install for? (Claude pre-selected)
│  ◼ Claude Code    ◻ Cursor    ◻ VS Code Copilot    ◻ Codex    ◻ Antigravity
```

The installer finishes every flow: skills are symlinked into each selected agent, the Atlassian MCP server is registered in each agent's own config format, `gh`/`glab` are installed — and each auth flow (`gh auth login`, `glab auth login`, Atlassian OAuth per agent) is run or walked through and verified before the installer declares success. Anything left pending is listed at the end.

Non-interactive:

```bash
npx github:umarbashirr/skillet --yes                          # recommended set, Claude
npx github:umarbashirr/skillet --only caveman,husky-setup     # install extras beyond the default set
npx github:umarbashirr/skillet --yes --skip glab              # default set minus an item
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
- **ralph-once** — single human-in-the-loop TDD iteration over a Jira story: PO test cases → failing tests → commit → implement → commit → lint/format/typecheck/build, Jira comment per stage, draft PR when the last subtask is done (`PRD.md` fallback; plus `ralph-once.sh`, on Windows also `ralph-once.cmd`; `afk-ralph.sh` autonomous loop is opt-in: `--only afk-ralph` or check it in the menu)
- **jira-ralph** — TDD loop over ready-for-agent Jira subtasks, ending in a draft PR
- **tdd** — red-green-refactor discipline: vertical slices, behavior-not-implementation tests, mocking and interface-design guides
- **prototype** — throwaway prototypes that answer a question: interactive terminal app for logic/state questions, or several radically different UI variations on one route
- **caveman** — ultra-compressed response mode (~75% fewer tokens, full technical accuracy)
- **nextjs-16** — Next.js 16 (App Router) expert knowledge base: SKILL router + reference docs (v16 changes, Cache Components/rendering, routing & data, Proxy/handlers/metadata/assets, config/CLI/deploy, doc map) wired to pull live docs via context7/nextjs.org
- **nextjs-playbooks** — Next.js 16 step-by-step procedures: scaffold-route, cache-components-setup, server-actions-forms, pages-to-app, v16-upgrade
- **husky-setup** — `/husky-setup` skill that scaffolds (or improvises on existing) husky git hooks in a JS/TS repo
- **frontend-design** — distinctive, intentional visual design guidance for building or reshaping UI (aesthetic direction, typography, non-templated choices) — by [Anthropic](https://github.com/anthropics/skills)
- **vercel-react-best-practices** — React/Next.js performance optimization rules (rerender, rendering, server, bundle, async) — by [Vercel](https://github.com/vercel-labs/agent-skills)
- **web-design-guidelines** — review UI code against the Web Interface Guidelines (accessibility, UX, design audit) — by [Vercel](https://github.com/vercel-labs/agent-skills)
- **agent-browser** — browser automation CLI for agents (navigate, fill forms, screenshot, scrape, test web apps) — by [Vercel Labs](https://github.com/vercel-labs/agent-browser); needs the `agent-browser` CLI at runtime (`npx agent-browser`)
- **spring-boot** — Spring Boot expert knowledge base: SKILL router + reference docs (REST/web, configuration & Actuator, DI & auto-configuration); detects the project's Boot/Java version and build tool, pulls live docs via context7/docs.spring.io
- **jpa-hibernate** — JPA / Hibernate & Spring Data JPA expert: entity mapping & relationships, repositories & queries (JPQL/derived/native), the N+1 problem, transactions & the persistence context
- **java-build** — Maven & Gradle build expert: lifecycle/tasks, dependency management & scopes, plugins, BOMs, multi-module, the Spring Boot build plugins, and CI
- **junit-testing** — Java testing expert: JUnit 5 (Jupiter), Mockito, and Spring Boot test support (slice tests, MockMvc, Testcontainers); pairs with the `tdd` skill for red-green-refactor discipline

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
- **husky git hooks** (opt-in) — scaffolds hooks into the **current** JS project (detected via `package.json` at the git root; skipped with a note otherwise). Installs `husky`, `lint-staged`, `commitlint` + config-conventional, and `secretlint` as devDeps, then wires:
  - **pre-commit** — `lint-staged` runs the detected linter/formatter (eslint/biome/prettier) + `secretlint` secret scan on staged files
  - **commit-msg** — `commitlint` enforces Conventional Commits
  - **pre-push** — typecheck (project script, else `tsc --noEmit`) + size gates: branch diff ≤ **1000** added code lines and each test file ≤ **2000** lines (lockfiles, docs, config, assets, snapshots excluded; tests excluded from the 1000)

  Check logic lives in committed `.skillet/hooks/*.mjs`; each `.husky` hook holds one skillet-managed block, so re-runs and your own hook lines coexist. Files are left unstaged for review. Secret scanning is local and bypassable with `--no-verify` — for a hard guarantee, add server-side scanning in CI. Tune via `commitlint.config.cjs`, `.lintstagedrc.json`, `.secretlintrc.json`, or env (`SKILLET_MAX_PROD`, `SKILLET_MAX_TEST_FILE`, `SKILLET_BASE_BRANCH`).

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

`grill-me`, `grill-with-docs`, `to-prd`, `to-issues`, `handoff`, `tdd`, `prototype`, `caveman`, and the Ralph technique are by [Matt Pocock](https://github.com/mattpocock/skills) ([aihero.dev — Getting Started with Ralph](https://www.aihero.dev/getting-started-with-ralph)). Jira adaptations and `jira-ralph` are our own additions. See [LICENSE](LICENSE).
