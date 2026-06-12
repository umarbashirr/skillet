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
];
const DEPS = [
  { value: 'jira-mcp', label: 'Atlassian (Jira) MCP server', hint: 'registered in every selected agent' },
  { value: 'gh', label: 'gh CLI', hint: 'GitHub CLI — NOT selected by default' },
  { value: 'glab', label: 'glab CLI', hint: 'GitLab CLI' },
  { value: 'afk-ralph', label: 'afk-ralph.sh', hint: 'autonomous Docker loop — NOT selected by default' },
];
const JIRA_SKILLS = new Set(['grill-me', 'grill-with-docs', 'to-prd', 'to-issues', 'handoff', 'ralph-once', 'jira-ralph']);
const ALL = [...SKILLS.map((s) => s.value), ...DEPS.map((d) => d.value)];
const DEFAULTS = ALL.filter((v) => !['afk-ralph', 'gh'].includes(v)); // afk loop and gh are opt-in

// Skills live canonically in .agents/skills (skills.sh convention) and are symlinked
// into each selected agent. MCP is registered per agent in its own config format.
const AGENTS = [
  { value: 'claude', label: 'Claude Code', detect: ['.claude'], skillsDir: ['.claude', 'skills'] },
  { value: 'cursor', label: 'Cursor', detect: ['.cursor'], skillsDir: ['.cursor', 'skills'] },
  { value: 'vscode-copilot', label: 'VS Code Copilot', detect: ['.config', 'Code'], skillsDir: ['.copilot', 'skills'] },
  { value: 'codex', label: 'Codex', detect: ['.codex'], skillsDir: ['.codex', 'skills'] },
  { value: 'antigravity', label: 'Antigravity', detect: ['.gemini'], skillsDir: ['.gemini', 'skills'] },
];

function parseArgs(argv) {
  const args = { yes: false, only: null, skip: new Set(), agents: null, domain: null, project: null, dest: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-y' || a === '--yes') args.yes = true;
    else if (a === '--only') args.only = argv[++i].split(',');
    else if (a === '--skip') argv[++i].split(',').forEach((s) => args.skip.add(s));
    else if (a === '--agents') args.agents = argv[++i].split(',');
    else if (a === '--jira-domain') args.domain = argv[++i];
    else if (a === '--jira-project') args.project = argv[++i];
    else if (a === '--dest') args.dest = argv[++i]; // 'global' | 'project'
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: skillet [options]

Interactive by default: everything pre-selected, uncheck to opt out.

Options:
  -y, --yes              non-interactive, accept all defaults
      --only a,b         install only these items
      --skip a,b         deselect items (works with --yes)
      --agents a,b       target agents (default: all detected)
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

function cmdOut(cmd, cmdArgs) {
  try {
    return String(execFileSync(cmd, cmdArgs, { stdio: 'pipe' }));
  } catch (e) {
    return `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
}

function cmdOk(cmd, cmdArgs) {
  try {
    execFileSync(cmd, cmdArgs, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function hasCmd(cmd) {
  return cmdOk(process.platform === 'win32' ? 'where' : 'which', [cmd]);
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
      execFileSync('claude', ['mcp', 'add', '--transport', 'http', 'atlassian', ATL_HTTP, '--scope', 'user'], { stdio: 'pipe' });
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
};

const CLI_AUTH = {
  gh: { check: ['gh', ['auth', 'status']], login: ['gh', ['auth', 'login']] },
  glab: { check: ['glab', ['auth', 'status']], login: ['glab', ['auth', 'login']] },
};

// Interactive auth loop: verify → run login / show steps → confirm → re-verify.
async function ensureAuth({ label, verify, login, steps, yes }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (verify && verify()) return `${label}: authenticated ✔`;
    if (yes) return `${label}: PENDING — ${steps}`;
    if (login && hasCmd(login[0])) {
      const go = await p.confirm({ message: `${label} not authenticated. Run \`${login[0]} ${login[1].join(' ')}\` now?` });
      if (p.isCancel(go)) bail();
      if (go) {
        spawnSync(login[0], login[1], { stdio: 'inherit' });
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  p.intro('🍳 skillet — agent workflow installer');

  // --- item selection ---
  let selected;
  if (args.yes || args.only) {
    selected = (args.only ?? DEFAULTS).filter((v) => !args.skip.has(v));
    const unknown = selected.filter((v) => !ALL.includes(v));
    if (unknown.length) bail(`Unknown items: ${unknown.join(', ')}`);
  } else {
    const pickedSkills = await p.multiselect({
      message: 'Which skills to install? (all selected — uncheck to opt out)',
      options: SKILLS,
      initialValues: SKILLS.map((s) => s.value).filter((v) => !args.skip.has(v)),
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

  const wantsJira = selected.some((s) => JIRA_SKILLS.has(s));

  // --- config ---
  let domain = args.domain ?? 'xcelore.atlassian.net';
  let project = args.project ?? 'XW';
  if (wantsJira && !args.yes && (!args.domain || !args.project)) {
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
    fs.mkdirSync(target, { recursive: true });
    const template = fs.readFileSync(path.join(BUNDLED, name, 'SKILL.md.template'), 'utf8');
    const rendered = template
      .replaceAll('{{JIRA_DOMAIN}}', domain)
      .replaceAll('{{JIRA_PROJECT}}', project);
    fs.writeFileSync(path.join(target, 'SKILL.md'), rendered);

    // supporting files (everything else in the bundled dir, verbatim)
    for (const f of fs.readdirSync(path.join(BUNDLED, name))) {
      if (f === 'SKILL.md.template') continue;
      fs.copyFileSync(path.join(BUNDLED, name, f), path.join(target, f));
    }

    // symlink the canonical copy into every selected agent
    for (const a of agentDefs) {
      if (!linkSkill(target, path.join(base, ...a.skillsDir), name, overwrite || args.yes)) {
        linkSkipped.push(`${a.value}/${name}`);
      }
    }
    installed.push(name);
  }

  // ralph scripts → project root (afk-ralph.sh is opt-in)
  const ralphScripts = [
    ...(installed.includes('ralph-once') ? ['ralph-once.sh'] : []),
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

  // --- Atlassian MCP per agent ---
  const mcpResults = [];
  if (selected.includes('jira-mcp')) {
    for (const a of agentDefs) {
      const s = p.spinner();
      s.start(`Registering Atlassian MCP in ${a.label}…`);
      try {
        const err = MCP_REGISTER[a.value](os.homedir());
        s.stop(err ? `${a.label}: MCP ✘` : `${a.label}: MCP ✔`);
        mcpResults.push(err ? `${a.label} MCP: FAILED — ${err}` : `${a.label} MCP: registered`);
      } catch (e) {
        s.stop(`${a.label}: MCP ✘`);
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
      ['winget', ['install', 'glab', '--accept-source-agreements', '--accept-package-agreements']],
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
    const s = p.spinner();
    s.start(`Installing ${dep}…`);
    let ok = false;
    let manual;
    if (process.platform === 'win32') {
      manual = dep === 'gh' ? 'winget install --id GitHub.cli -e' : 'winget install glab';
      for (const [tool, argv] of WIN_INSTALL[dep]) {
        if (!hasCmd(tool)) continue;
        if (spawnSync(tool, argv, { stdio: 'pipe', shell: true }).status === 0) {
          ok = true;
          break;
        }
      }
    } else {
      manual = `bash ${DEPS_SCRIPT} --${dep}`;
      try {
        execFileSync('bash', [DEPS_SCRIPT, `--${dep}`], { stdio: 'pipe' });
        ok = true;
      } catch (e) {
        if (e.stderr) console.error(String(e.stderr).trim());
      }
    }
    s.stop(ok ? `${dep} ✔` : `${dep} ✘`);
    depResults.push(ok ? `${dep}: installed` : `${dep}: FAILED — install manually: ${manual}`);
    if (ok && process.platform === 'win32' && !hasCmd(dep)) {
      depResults.push(`${dep}: open a NEW terminal for it to be on PATH, then run \`${dep} auth login\``);
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
  const lines = [];
  if (installed.length) lines.push(`Skills → ${destDir}: ${installed.join(', ')}`);
  if (installed.length) lines.push(`Symlinked into: ${agents.join(', ')}`);
  if (skipped.length) lines.push(`Skipped (already present): ${skipped.join(', ')}`);
  if (linkSkipped.length) lines.push(`⚠ NOT symlinked (real dir in the way, no overwrite): ${linkSkipped.join(', ')}`);
  if (wantsJira) lines.push(`Jira: ${domain} / ${project}`);
  lines.push(...mcpResults, ...depResults, ...authResults);
  p.note(lines.join('\n'), 'Installed');

  const pending = authResults.filter((l) => /PENDING|SKIPPED|not verified/.test(l));
  p.outro(
    (pending.length
      ? `⚠ Finish auth before using the workflow:\n   ${pending.join('\n   ')}\n`
      : '✔ All auth verified.\n') +
      '   Restart your agent session, then: /grill-me <jira-url> → /to-prd → /to-issues → /jira-ralph <KEY>',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
