#!/usr/bin/env node
import * as p from '@clack/prompts';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLED = path.join(__dirname, '..', 'skills', 'skillet-setup', 'bundled');
const DEPS_SCRIPT = path.join(__dirname, '..', 'skills', 'skillet-setup', 'scripts', 'install-deps.sh');

const ATL_HTTP = 'https://mcp.atlassian.com/v1/mcp';
const ATL_SSE = 'https://mcp.atlassian.com/v1/sse';

const SKILLS = [
  { value: 'grill-me', label: 'grill-me', hint: 'relentless plan interview, Jira-seedable' },
  { value: 'grill-with-docs', label: 'grill-with-docs', hint: 'grilling that maintains CONTEXT.md/ADRs, Jira-seedable' },
  { value: 'to-prd', label: 'to-prd', hint: 'conversation → PRD as Jira subtask' },
  { value: 'to-issues', label: 'to-issues', hint: 'PRD → ready-for-agent Jira subtasks' },
  { value: 'handoff', label: 'handoff', hint: 'handoff doc + Jira handoff comments' },
  { value: 'ralph-once', label: 'ralph-once', hint: 'single Jira TDD Ralph iteration + loop scripts' },
  { value: 'jira-ralph', label: 'jira-ralph', hint: 'TDD loop over Jira subtasks → draft PR' },
  { value: 'tdd', label: 'tdd', hint: 'red-green-refactor TDD discipline' },
  { value: 'prototype', label: 'prototype', hint: 'throwaway prototypes — terminal logic or UI variations' },
  { value: 'caveman', label: 'caveman', hint: 'ultra-compressed responses, ~75% fewer tokens' },
  { value: 'nextjs-16', label: 'nextjs-16', hint: 'Next.js 16 App Router expert knowledge base' },
  { value: 'nextjs-playbooks', label: 'nextjs-playbooks', hint: 'Next.js 16 step-by-step build/migrate procedures' },
  { value: 'husky-setup', label: 'husky-setup', hint: 'scaffold husky git hooks: lint/format/secret/typecheck/size gates + commit standards' },
  { value: 'frontend-design', label: 'frontend-design', hint: 'distinctive, intentional UI/visual design — Anthropic' },
  { value: 'vercel-react-best-practices', label: 'vercel-react-best-practices', hint: 'React/Next.js performance rules — Vercel' },
  { value: 'web-design-guidelines', label: 'web-design-guidelines', hint: 'audit UI against Web Interface Guidelines — Vercel' },
  { value: 'agent-browser', label: 'agent-browser', hint: 'browser automation CLI for agents — Vercel Labs' },
  { value: 'spring-boot', label: 'spring-boot', hint: 'Spring Boot expert — auto-config, REST, DI, Actuator' },
  { value: 'jpa-hibernate', label: 'jpa-hibernate', hint: 'JPA/Hibernate + Spring Data — mapping, queries, N+1, tx' },
  { value: 'java-build', label: 'java-build', hint: 'Java build — Maven & Gradle, deps, plugins, CI' },
  { value: 'junit-testing', label: 'junit-testing', hint: 'Java testing — JUnit 5, Mockito, Spring Boot Test' },
];
const DEPS = [
  { value: 'jira-mcp', label: 'Atlassian (Jira) MCP server', hint: 'registered in every selected agent' },
  { value: 'gh', label: 'gh CLI', hint: 'GitHub CLI — NOT selected by default' },
  { value: 'glab', label: 'glab CLI', hint: 'GitLab CLI' },
  { value: 'husky', label: 'husky git hooks', hint: 'scaffold hooks into THIS project (JS only) — NOT selected by default' },
  { value: 'afk-ralph', label: 'afk-ralph.sh', hint: 'autonomous Docker loop — NOT selected by default' },
];
// husky-setup has supporting subdirs (hooks/, configs/) copied verbatim, unlike
// the flat skills whose only extra files are top-level reference docs.
const SUBDIR_SKILLS = new Set(['husky-setup']);
const ALL = [...SKILLS.map((s) => s.value), ...DEPS.map((d) => d.value)];
// Pre-selected by default (interactive checkboxes + `--yes`). Everything else is
// opt-in: check it in the menu or pass it via `--only`.
const DEFAULT_SKILLS = ['grill-me', 'to-prd', 'to-issues', 'tdd', 'jira-ralph'];
const DEFAULT_DEPS = ['jira-mcp', 'glab'];
const DEFAULTS = [...DEFAULT_SKILLS, ...DEFAULT_DEPS];

// Skills live canonically in .agents/skills (skills.sh convention) and are symlinked
// into each selected agent. MCP is registered per agent in its own config format.
const AGENTS = [
  { value: 'claude', label: 'Claude Code', detect: ['.claude'], skillsDir: ['.claude', 'skills'] },
  { value: 'cursor', label: 'Cursor', detect: ['.cursor'], skillsDir: ['.cursor', 'skills'] },
  { value: 'vscode-copilot', label: 'VS Code Copilot', detect: ['.config', 'Code'], skillsDir: ['.copilot', 'skills'] },
  { value: 'codex', label: 'Codex', detect: ['.codex'], skillsDir: ['.codex', 'skills'] },
  { value: 'antigravity', label: 'Antigravity', detect: ['.gemini'], skillsDir: ['.gemini', 'skills'] },
  { value: 'cline', label: 'Cline', detect: ['.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev'], skillsDir: ['.cline', 'skills'] },
];

function parseArgs(argv) {
  const args = { yes: false, only: null, skip: new Set(), agents: null, tracker: null, domain: null, project: null, dest: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-y' || a === '--yes') args.yes = true;
    else if (a === '--only') args.only = argv[++i].split(',');
    else if (a === '--skip') argv[++i].split(',').forEach((s) => args.skip.add(s));
    else if (a === '--agents') args.agents = argv[++i].split(',');
    else if (a === '--tracker') args.tracker = argv[++i]; // 'jira' | 'local'
    else if (a === '--jira-domain') args.domain = argv[++i];
    else if (a === '--jira-project') args.project = argv[++i];
    else if (a === '--dest') args.dest = argv[++i]; // 'global' | 'project'
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: skillet [options]

Interactive by default: a recommended set is pre-selected; check more or uncheck.

Options:
  -y, --yes              non-interactive, accept all defaults
      --only a,b         install only these items
      --skip a,b         deselect items (works with --yes)
      --agents a,b       target agents (default: all detected)
      --tracker jira|local   issue tracker (default: jira)
      --jira-domain X    Jira domain (default: xcelore.atlassian.net)
      --jira-project X   Jira project key (default: XW)
      --dest global|project   skills dir (default: global)

Items:  ${ALL.join(', ')}
Agents: ${AGENTS.map((a) => a.value).join(', ')}`);
      process.exit(0);
    }
  }
  return args;
}

function bail(msg) {
  p.cancel(msg ?? 'Cancelled.');
  process.exit(1);
}

// Kitchen-themed loading quips so nothing ever looks stuck.
const QUIPS = [
  'Preheating the skillet',
  'Greasing the pan',
  'Cracking the eggs',
  'Whisking the config',
  'Seasoning to taste',
  'Flipping the pancakes',
  'Taste-testing the symlinks',
  'Sharpening the spatulas',
  'Convincing Jira politely',
  'Bribing the OAuth gods',
  'Untangling the spaghetti',
  'Feeding the agents',
  'Simmering on low heat',
  'Plating it up nicely',
];
let quipIdx = Math.floor(Math.random() * QUIPS.length);
const quip = () => QUIPS[quipIdx++ % QUIPS.length];

function detectedAgents() {
  return AGENTS.filter((a) => fs.existsSync(path.join(os.homedir(), ...a.detect))).map((a) => a.value);
}

// Link canonical skill dir into an agent's skills dir. Replaces stale links;
// replaces real dirs only when allowed (caller decided overwrite).
// Windows: plain symlinks need admin/Developer Mode (EPERM otherwise), so use a
// directory junction there; if even that fails, fall back to a plain copy.
function linkSkill(canonical, agentSkillsDir, name, overwrite) {
  const target = path.join(agentSkillsDir, name);
  fs.mkdirSync(agentSkillsDir, { recursive: true });
  const stat = fs.lstatSync(target, { throwIfNoEntry: false });
  if (stat) {
    if (stat.isSymbolicLink()) fs.unlinkSync(target);
    else if (overwrite) fs.rmSync(target, { recursive: true });
    else return false;
  }
  if (process.platform === 'win32') {
    try {
      fs.symlinkSync(canonical, target, 'junction');
    } catch {
      fs.cpSync(canonical, target, { recursive: true });
    }
  } else {
    fs.symlinkSync(canonical, target, 'dir');
  }
  return true;
}

// npm-installed CLIs (claude, codex, gh…) are .cmd shims on Windows — Node can
// only spawn those through a shell, hence shell: true on win32 everywhere.
const WINSHELL = process.platform === 'win32';

function cmdOut(cmd, cmdArgs) {
  try {
    return String(execFileSync(cmd, cmdArgs, { stdio: 'pipe', shell: WINSHELL }));
  } catch (e) {
    return `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
}

function cmdOk(cmd, cmdArgs) {
  try {
    execFileSync(cmd, cmdArgs, { stdio: 'pipe', shell: WINSHELL });
    return true;
  } catch {
    return false;
  }
}

function hasCmd(cmd) {
  return cmdOk(process.platform === 'win32' ? 'where' : 'which', [cmd]);
}

function winLocalAppData() {
  return process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
}

const WIN_SKILLET_BIN = () => path.join(winLocalAppData(), 'skillet', 'bin');

// Windows: locate a freshly installed binary that isn't on this process's PATH yet.
function winFindBinDir(dep) {
  const home = os.homedir();
  const candidates = [
    path.join(winLocalAppData(), 'Microsoft', 'WinGet', 'Links'),
    path.join(home, 'scoop', 'shims'),
    'C:\\ProgramData\\chocolatey\\bin',
    WIN_SKILLET_BIN(),
  ];
  return candidates.find((dir) => fs.existsSync(path.join(dir, `${dep}.exe`))) ?? null;
}

// Last-resort Windows install: download the official release zip and drop the
// exe into %LocalAppData%\skillet\bin — no package manager, no admin needed.
async function winBinaryInstall(dep) {
  const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
  let url;
  if (dep === 'glab') {
    const rel = await (await fetch('https://gitlab.com/api/v4/projects/gitlab-org%2Fcli/releases')).json();
    const v = rel[0].tag_name;
    url = `https://gitlab.com/gitlab-org/cli/-/releases/${v}/downloads/glab_${v.slice(1)}_windows_${arch}.zip`;
  } else {
    const rel = await (await fetch('https://api.github.com/repos/cli/cli/releases/latest')).json();
    const v = rel.tag_name;
    url = `https://github.com/cli/cli/releases/download/${v}/gh_${v.slice(1)}_windows_${arch}.zip`;
  }
  const zip = path.join(os.tmpdir(), `skillet-${dep}.zip`);
  fs.writeFileSync(zip, Buffer.from(await (await fetch(url)).arrayBuffer()));
  const extract = path.join(os.tmpdir(), `skillet-${dep}-extract`);
  fs.rmSync(extract, { recursive: true, force: true });
  const r = spawnSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -Path '${zip}' -DestinationPath '${extract}' -Force`], { stdio: 'pipe' });
  if (r.status !== 0) return false;
  const findExe = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) {
        const hit = findExe(fp);
        if (hit) return hit;
      } else if (e.name === `${dep}.exe`) return fp;
    }
    return null;
  };
  const exe = findExe(extract);
  if (!exe) return false;
  fs.mkdirSync(WIN_SKILLET_BIN(), { recursive: true });
  fs.copyFileSync(exe, path.join(WIN_SKILLET_BIN(), `${dep}.exe`));
  winAddPath(WIN_SKILLET_BIN());
  return true;
}

// choco writes to C:\ProgramData — pointless without an elevated terminal.
function winIsElevated() {
  return spawnSync('net', ['session'], { stdio: 'pipe', shell: true }).status === 0;
}

// Add a dir to PATH for this process AND persist it to the user PATH so future
// terminals get it. PowerShell, not setx — setx truncates PATH at 1024 chars.
function winAddPath(dir) {
  process.env.PATH = `${process.env.PATH};${dir}`;
  const ps = `$u=[Environment]::GetEnvironmentVariable('Path','User'); if(($u -split ';') -notcontains '${dir}'){[Environment]::SetEnvironmentVariable('Path', ($u.TrimEnd(';') + ';' + '${dir}'), 'User')}`;
  return spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'pipe' }).status === 0;
}

// Merge a key into a JSON config file without clobbering what's already there.
// Unparseable files are backed up to <file>.bak and replaced.
function mergeJsonFile(file, mutate) {
  let obj = {};
  if (fs.existsSync(file)) {
    try {
      obj = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      fs.copyFileSync(file, `${file}.bak`);
    }
  }
  mutate(obj);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`);
}

// --- Atlassian MCP registration, one shape per agent ---
const MCP_REGISTER = {
  claude(home) {
    if (!hasCmd('claude')) return 'claude CLI not found — npm i -g @anthropic-ai/claude-code, then re-run';
    if (!/atlassian/i.test(cmdOut('claude', ['mcp', 'list']))) {
      execFileSync('claude', ['mcp', 'add', '--transport', 'http', 'atlassian', ATL_HTTP, '--scope', 'user'], { stdio: 'pipe', shell: WINSHELL });
    }
    return null;
  },
  cursor(home) {
    mergeJsonFile(path.join(home, '.cursor', 'mcp.json'), (o) => {
      o.mcpServers ??= {};
      o.mcpServers.atlassian ??= { url: ATL_HTTP };
    });
    return null;
  },
  'vscode-copilot'(home) {
    const file =
      process.platform === 'darwin'
        ? path.join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json')
        : process.platform === 'win32'
          ? path.join(process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming'), 'Code', 'User', 'mcp.json')
          : path.join(home, '.config', 'Code', 'User', 'mcp.json');
    mergeJsonFile(file, (o) => {
      o.servers ??= {};
      o.servers.atlassian ??= { type: 'http', url: ATL_HTTP };
    });
    return null;
  },
  codex(home) {
    const file = path.join(home, '.codex', 'config.toml');
    const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (!/\[mcp_servers\.atlassian\]/.test(cur)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, `\n[mcp_servers.atlassian]\nurl = "${ATL_HTTP}"\n`);
    }
    return null;
  },
  antigravity(home) {
    // mcp-remote wrapper: handles the OAuth browser flow on first use.
    mergeJsonFile(path.join(home, '.gemini', 'config', 'mcp_config.json'), (o) => {
      o.mcpServers ??= {};
      o.mcpServers.atlassian ??= { command: 'npx', args: ['-y', 'mcp-remote', ATL_SSE] };
    });
    return null;
  },
  cline(home) {
    const file =
      process.platform === 'darwin'
        ? path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json')
        : process.platform === 'win32'
          ? path.join(process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming'), 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json')
          : path.join(home, '.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
    mergeJsonFile(file, (o) => {
      o.mcpServers ??= {};
      o.mcpServers.atlassian ??= { url: ATL_HTTP, disabled: false, autoApprove: [] };
    });
    return null;
  },
};

// --- Auth flows: how to verify, how to complete ---
const MCP_AUTH = {
  claude: {
    verify: () => /atlassian.*(✓|connected)/i.test(cmdOut('claude', ['mcp', 'list'])),
    steps: 'Open a Claude Code session, run /mcp, pick "atlassian", complete the browser OAuth.',
  },
  cursor: {
    verify: null,
    steps: 'Open Cursor → Settings → MCP → "atlassian" → Login (browser OAuth).',
  },
  'vscode-copilot': {
    verify: null,
    steps: 'Open VS Code → Command Palette → "MCP: List Servers" → start "atlassian" → complete the auth prompt.',
  },
  codex: {
    verify: () => /atlassian/i.test(cmdOut('codex', ['mcp', 'list'])),
    login: ['codex', ['mcp', 'login', 'atlassian']],
    steps: 'Run: codex mcp login atlassian',
  },
  antigravity: {
    verify: null,
    steps: 'Open Antigravity → Agent panel "…" → MCP Servers → refresh "atlassian"; the first use opens the mcp-remote browser OAuth.',
  },
  cline: {
    verify: null,
    steps: 'Open VS Code with Cline → click the MCP icon in the Cline panel → find "atlassian" → complete the browser OAuth.',
  },
};

const CLI_AUTH = {
  gh: { check: ['gh', ['auth', 'status']], login: ['gh', ['auth', 'login']] },
  glab: { check: ['glab', ['auth', 'status']], login: ['glab', ['auth', 'login']] },
};

// Interactive auth loop: verify → run login / show steps → confirm → re-verify.
async function ensureAuth({ label, verify, login, steps, yes }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (verify) {
      const s = p.spinner();
      s.start(`${quip()}… checking ${label} auth`);
      const ok = verify();
      s.stop(ok ? `${label} auth ${ICON.ok}` : `${label} auth ${c.yellow('not done yet')}`);
      if (ok) return `${label}: authenticated ✔`;
    }
    if (yes) return `${label}: PENDING — ${steps}`;
    if (login && hasCmd(login[0])) {
      const go = await p.confirm({ message: `${label} not authenticated. Run \`${login[0]} ${login[1].join(' ')}\` now?` });
      if (p.isCancel(go)) bail();
      if (go) {
        spawnSync(login[0], login[1], { stdio: 'inherit', shell: WINSHELL });
        continue; // re-verify
      }
      return `${label}: SKIPPED — ${steps}`;
    }
    // no CLI login / no verify: manual steps + user confirmation
    p.note(steps, `${label} — complete auth`);
    const done = await p.confirm({ message: `${label}: done with the steps above? (No = skip for now)` });
    if (p.isCancel(done)) bail();
    if (!verify) return done ? `${label}: confirmed by user ✔` : `${label}: SKIPPED — ${steps}`;
    if (!done) return `${label}: SKIPPED — ${steps}`;
  }
  return `${label}: still not verified — ${steps}`;
}

// --- color: honor NO_COLOR + non-TTY (FORCE_COLOR overrides) ---
const NO_COLOR = !!process.env.NO_COLOR || (!process.stdout.isTTY && !process.env.FORCE_COLOR);
const sgr = (open, close) => (s) => (NO_COLOR ? `${s}` : `\x1b[${open}m${s}\x1b[${close}m`);
const x256 = (code) => (s) => (NO_COLOR ? `${s}` : `\x1b[38;5;${code}m${s}\x1b[39m`);
const c = {
  bold: sgr(1, 22),
  dim: sgr(2, 22),
  red: sgr(31, 39),
  green: sgr(32, 39),
  yellow: sgr(33, 39),
  cyan: sgr(36, 39),
  orange: x256(208),
};
const ICON = { ok: c.green('✔'), fail: c.red('✘'), warn: c.yellow('⚠'), info: c.cyan('•') };

let VERSION = '';
try {
  VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;
} catch {}

// Warm "skillet on the heat" gradient: red → orange → amber → gold → yellow.
const FIRE = [196, 202, 208, 214, 220];
const ART = [
  '  ███████ ██   ██ ██ ██      ██      ███████ ████████',
  '  ██      ██  ██  ██ ██      ██      ██         ██',
  '  ███████ █████   ██ ██      ██      █████      ██',
  '       ██ ██  ██  ██ ██      ██      ██         ██',
  '  ███████ ██   ██ ██ ███████ ███████ ███████    ██',
];
const banner = () => {
  const art = ART.map((row, i) => x256(FIRE[i])(row)).join('\n');
  const ver = VERSION ? c.dim(`v${VERSION}`) : '';
  const title = `  🍳 ${c.bold(c.orange('Skillet'))} ${ver} ${c.dim('— agent workflow installer')}`;
  return `\n${art}\n\n${title}\n  ${c.dim('by Umar Bashir')}\n`;
};

// Pick a colored status icon for a summary line from its keywords.
const statusLine = (s) => {
  if (/FAILED|✘|not verified/.test(s)) return `${ICON.fail} ${s.replace(/[✘]/g, '').trim()}`;
  if (/PENDING|SKIPPED|⚠/.test(s)) return `${ICON.warn} ${s.replace(/[⚠]/g, '').trim()}`;
  if (/✔|registered|installed|authenticated|scaffolded|confirmed/.test(s)) return `${ICON.ok} ${s.replace(/[✔]/g, '').trim()}`;
  return `${ICON.info} ${s}`;
};
const row = (k, v) => `${c.bold(k.padEnd(10))} ${v}`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(banner());
  p.intro(`${c.orange('🍳')} ${c.bold('skillet setup')}`);

  // --- item selection ---
  let selected;
  if (args.yes || args.only) {
    selected = (args.only ?? DEFAULTS).filter((v) => !args.skip.has(v));
    const unknown = selected.filter((v) => !ALL.includes(v));
    if (unknown.length) bail(`Unknown items: ${unknown.join(', ')}`);
  } else {
    const pickedSkills = await p.multiselect({
      message: 'Which skills to install? (recommended set pre-selected — check more or uncheck)',
      options: SKILLS,
      initialValues: DEFAULT_SKILLS.filter((v) => !args.skip.has(v)),
      required: false,
    });
    if (p.isCancel(pickedSkills)) bail();
    const pickedDeps = await p.multiselect({
      message: 'Which integrations/CLIs to install? (uncheck to opt out)',
      options: DEPS,
      initialValues: DEPS.map((d) => d.value).filter((v) => DEFAULTS.includes(v) && !args.skip.has(v)),
      required: false,
    });
    if (p.isCancel(pickedDeps)) bail();
    selected = [...pickedSkills, ...pickedDeps];
  }
  if (!selected.length) bail('Nothing selected.');

  // --- agent selection ---
  const detected = detectedAgents();
  let agents;
  if (args.agents) {
    agents = args.agents;
    const unknown = agents.filter((v) => !AGENTS.some((a) => a.value === v));
    if (unknown.length) bail(`Unknown agents: ${unknown.join(', ')} (valid: ${AGENTS.map((a) => a.value).join(', ')})`);
  } else if (args.yes) {
    agents = ['claude'];
  } else {
    const picked = await p.multiselect({
      message: 'Which agents to install for? (Claude pre-selected)',
      options: AGENTS.map((a) => ({
        value: a.value,
        label: a.label,
        hint: detected.includes(a.value) ? 'detected' : undefined,
      })),
      initialValues: ['claude'],
      required: true,
    });
    if (p.isCancel(picked)) bail();
    agents = picked;
  }
  const agentDefs = AGENTS.filter((a) => agents.includes(a.value));

  // --- tracker (asked every interactive run) ---
  let tracker = args.tracker ?? (args.yes ? 'jira' : null);
  if (tracker === null) {
    const t = await p.select({
      message: 'Select tracker',
      options: [
        { value: 'jira', label: 'JIRA', hint: 'domain + project key' },
        { value: 'local', label: 'Locally', hint: 'no Jira — local / PRD.md mode' },
      ],
      initialValue: 'jira',
    });
    if (p.isCancel(t)) bail();
    tracker = t;
  }

  // --- config (Jira domain + key only when tracker = jira) ---
  let domain = '';
  let project = '';
  if (tracker === 'jira') {
    domain = args.domain ?? 'xcelore.atlassian.net';
    project = args.project ?? 'XW';
    if (!args.yes && (!args.domain || !args.project)) {
      const d = await p.text({
        message: 'Jira domain',
        defaultValue: domain,
        placeholder: domain,
      });
      if (p.isCancel(d)) bail();
      domain = d || domain;
      const k = await p.text({
        message: 'Jira project key',
        defaultValue: project,
        placeholder: project,
      });
      if (p.isCancel(k)) bail();
      project = (k || project).toUpperCase();
    }
  }

  let destChoice = args.dest ?? 'global';
  if (!args.yes && !args.dest) {
    const d = await p.select({
      message: 'Where to install the skills?',
      options: [
        { value: 'global', label: 'Global — ~/.agents/skills, symlinked into the selected agents' },
        { value: 'project', label: 'Project — ./.agents/skills (this repo only)' },
      ],
      initialValue: 'global',
    });
    if (p.isCancel(d)) bail();
    destChoice = d;
  }
  const base = destChoice === 'global' ? os.homedir() : process.cwd();
  const destDir = path.join(base, '.agents', 'skills');

  // --- install skills ---
  const skillsToInstall = selected.filter((v) => SKILLS.some((s) => s.value === v));
  const installed = [];
  const skipped = [];
  const linkSkipped = [];

  for (const name of skillsToInstall) {
    const target = path.join(destDir, name);
    let overwrite = args.yes; // --yes overwrites; interactive asks
    if (fs.existsSync(path.join(target, 'SKILL.md'))) {
      if (!args.yes) {
        const ok = await p.confirm({ message: `${name} already exists in ${destDir} — overwrite?` });
        if (p.isCancel(ok)) bail();
        overwrite = ok;
      }
      if (!overwrite) {
        skipped.push(name);
        continue;
      }
    }
    const sk = p.spinner();
    sk.start(`${quip()}… installing ${name}`);
    fs.mkdirSync(target, { recursive: true });
    const template = fs.readFileSync(path.join(BUNDLED, name, 'SKILL.md.template'), 'utf8');
    const rendered = template
      .replaceAll('{{JIRA_DOMAIN}}', domain)
      .replaceAll('{{JIRA_PROJECT}}', project);
    fs.writeFileSync(path.join(target, 'SKILL.md'), rendered);

    // supporting files (everything else in the bundled dir, verbatim) —
    // recurse into subdirs for skills that ship them (e.g. husky-setup).
    for (const f of fs.readdirSync(path.join(BUNDLED, name), { withFileTypes: true })) {
      if (f.name === 'SKILL.md.template') continue;
      const src = path.join(BUNDLED, name, f.name);
      const dst = path.join(target, f.name);
      if (f.isDirectory()) fs.cpSync(src, dst, { recursive: true });
      else fs.copyFileSync(src, dst);
    }

    // symlink the canonical copy into every selected agent
    for (const a of agentDefs) {
      if (!linkSkill(target, path.join(base, ...a.skillsDir), name, overwrite || args.yes)) {
        linkSkipped.push(`${a.value}/${name}`);
      }
    }
    installed.push(name);
    sk.stop(`${name} ${ICON.ok}`);
  }

  // ralph scripts → project root (afk-ralph.sh is opt-in)
  // Windows also gets ralph-once.cmd — .sh only runs under Git Bash there.
  const ralphScripts = [
    ...(installed.includes('ralph-once') ? ['ralph-once.sh', ...(WINSHELL ? ['ralph-once.cmd'] : [])] : []),
    ...(selected.includes('afk-ralph') ? ['afk-ralph.sh'] : []),
  ];
  if (ralphScripts.length) {
    for (const f of ralphScripts) {
      const src = path.join(BUNDLED, 'ralph-once', f);
      const dst = path.join(process.cwd(), f);
      if (fs.existsSync(dst) && fs.readFileSync(dst, 'utf8') !== fs.readFileSync(src, 'utf8')) {
        let ow = args.yes;
        if (!args.yes) {
          const ok = await p.confirm({ message: `${f} exists with local changes — overwrite?` });
          if (p.isCancel(ok)) bail();
          ow = ok;
        }
        if (!ow) {
          skipped.push(f);
          continue;
        }
      }
      fs.copyFileSync(src, dst);
      fs.chmodSync(dst, 0o755);
    }
    const progress = path.join(process.cwd(), 'progress.txt');
    if (!fs.existsSync(progress)) fs.writeFileSync(progress, '');
  }

  // --- husky hooks (scaffold into the current project) ---
  const huskyResults = [];
  if (selected.includes('husky')) {
    const scaffold = path.join(BUNDLED, 'husky-setup', 'scaffold.mjs');
    p.note('Scaffolding husky hooks into the current project — installs devDeps and may take a moment.', 'husky');
    // stdio inherited so the dependency install and summary stream live.
    const r = spawnSync('node', [scaffold, process.cwd()], { stdio: 'inherit', shell: WINSHELL });
    if (r.status === 0) huskyResults.push(`husky: hooks scaffolded in ${process.cwd()}`);
    else if (r.status === 2) huskyResults.push('husky: SKIPPED — current dir is not a JS git project (run /husky-setup inside a Node repo)');
    else huskyResults.push('husky: FAILED — see output above (often a dependency-install error; re-run inside the project)');
  }

  // --- Atlassian MCP per agent ---
  const mcpResults = [];
  if (selected.includes('jira-mcp')) {
    for (const a of agentDefs) {
      const s = p.spinner();
      s.start(`${quip()}… registering Atlassian MCP in ${a.label}`);
      try {
        const err = MCP_REGISTER[a.value](os.homedir());
        s.stop(`${a.label}: MCP ${err ? ICON.fail : ICON.ok}`);
        mcpResults.push(err ? `${a.label} MCP: FAILED — ${err}` : `${a.label} MCP: registered`);
      } catch (e) {
        s.stop(`${a.label}: MCP ${ICON.fail}`);
        mcpResults.push(`${a.label} MCP: FAILED — ${String(e.message ?? e).split('\n')[0]}`);
      }
    }
  }

  // --- CLI deps ---
  // Windows: the deps script is bash — use winget/scoop/choco instead.
  const WIN_INSTALL = {
    gh: [
      ['winget', ['install', '--id', 'GitHub.cli', '-e', '--accept-source-agreements', '--accept-package-agreements']],
      ['scoop', ['install', 'gh']],
      ['choco', ['install', 'gh', '-y']],
    ],
    glab: [
      ['winget', ['install', '-e', '--id', 'GLab.GLab', '--accept-source-agreements', '--accept-package-agreements']],
      ['scoop', ['install', 'glab']],
      ['choco', ['install', 'glab', '-y']],
    ],
  };
  const depResults = [];
  for (const dep of ['gh', 'glab'].filter((d) => selected.includes(d))) {
    if (hasCmd(dep)) {
      depResults.push(`${dep}: already installed`);
      continue;
    }
    // installed but missing from PATH (fresh winget install, stale terminal) — just heal PATH
    if (process.platform === 'win32') {
      const existing = winFindBinDir(dep);
      if (existing) {
        const persisted = winAddPath(existing);
        depResults.push(
          `${dep}: already installed — ${persisted ? `added ${existing} to PATH (this session + future terminals)` : `on PATH for this session; add ${existing} to your user PATH manually`}`,
        );
        continue;
      }
    }
    const s = p.spinner();
    s.start(`${quip()}… installing ${dep}`);
    let ok = false;
    let manual;
    if (process.platform === 'win32') {
      manual = dep === 'gh' ? 'winget install --id GitHub.cli -e' : 'winget install -e --id GLab.GLab';
      let lastErr = '';
      for (const [tool, argv] of WIN_INSTALL[dep]) {
        if (!hasCmd(tool)) continue;
        if (tool === 'choco' && !winIsElevated()) continue; // choco needs an admin terminal
        const r = spawnSync(tool, argv, { stdio: 'pipe', shell: true });
        if (r.status === 0) {
          ok = true;
          break;
        }
        lastErr = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-2).join(' ').slice(0, 200);
      }
      if (!ok) {
        // no manager worked — pull the official release binary directly
        s.message(`${quip()}… downloading ${dep} release binary`);
        try {
          ok = await winBinaryInstall(dep);
        } catch {
          ok = false;
        }
      }
      if (!ok && lastErr) manual = `${manual} (last error: ${lastErr})`;
    } else {
      manual = `bash ${DEPS_SCRIPT} --${dep}`;
      try {
        execFileSync('bash', [DEPS_SCRIPT, `--${dep}`], { stdio: 'pipe' });
        ok = true;
      } catch (e) {
        if (e.stderr) console.error(String(e.stderr).trim());
      }
    }
    s.stop(`${dep} ${ok ? ICON.ok : ICON.fail}`);
    depResults.push(ok ? `${dep}: installed` : `${dep}: FAILED — install manually: ${manual}`);
    // self-heal PATH so auth can run in this same session
    if (ok && process.platform === 'win32' && !hasCmd(dep)) {
      const binDir = winFindBinDir(dep);
      if (binDir) {
        const persisted = winAddPath(binDir);
        depResults.push(
          persisted
            ? `${dep}: added ${binDir} to PATH (this session + future terminals)`
            : `${dep}: on PATH for this session; persisting failed — add ${binDir} to your user PATH manually`,
        );
      } else {
        depResults.push(`${dep}: installed but binary not found — open a NEW terminal, then run \`${dep} auth login\``);
      }
    }
  }

  // --- auth completion ---
  const authResults = [];
  for (const dep of ['gh', 'glab'].filter((d) => selected.includes(d) && hasCmd(d))) {
    const { check, login } = CLI_AUTH[dep];
    authResults.push(
      await ensureAuth({
        label: dep,
        verify: () => cmdOk(check[0], check[1]),
        login,
        steps: `Run: ${login[0]} ${login[1].join(' ')}`,
        yes: args.yes,
      }),
    );
  }
  if (selected.includes('jira-mcp')) {
    for (const a of agentDefs) {
      const auth = MCP_AUTH[a.value];
      authResults.push(
        await ensureAuth({
          label: `Atlassian MCP (${a.label})`,
          verify: auth.verify,
          login: auth.login,
          steps: auth.steps,
          yes: args.yes,
        }),
      );
    }
  }

  // --- summary ---
  const info = [];
  if (installed.length) info.push(row('Skills', installed.join(', ')));
  if (installed.length) info.push(row('Agents', agents.join(', ')));
  info.push(row('Location', c.dim(destDir)));
  info.push(row('Tracker', tracker === 'jira' ? `Jira ${c.dim('·')} ${domain} ${c.dim('/')} ${project}` : 'Local'));
  if (skipped.length) info.push(row('Skipped', c.dim(skipped.join(', '))));
  if (linkSkipped.length) info.push(`${ICON.warn} not symlinked (real dir in the way): ${linkSkipped.join(', ')}`);

  const status = [...mcpResults, ...depResults, ...huskyResults, ...authResults].map(statusLine);
  const body = [...info, ...(status.length ? ['', ...status] : [])].join('\n');
  p.note(body, c.bold('Summary'));

  const next = `${c.dim('Restart your agent session, then:')}\n   ` +
    [c.cyan('/grill-me <jira-url>'), c.cyan('/to-prd'), c.cyan('/to-issues'), c.cyan('/jira-ralph <KEY>')].join(c.dim(' → '));
  const pending = authResults.filter((l) => /PENDING|SKIPPED|not verified/.test(l));
  p.outro(
    (pending.length
      ? `${c.yellow('⚠ Finish auth before using the workflow:')}\n   ${pending.map((l) => c.dim(l)).join('\n   ')}\n\n`
      : `${c.green('✔ All auth verified.')}\n\n`) + next,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
