#!/usr/bin/env node
import * as p from '@clack/prompts';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLED = path.join(__dirname, '..', 'skills', 'skillet-setup', 'bundled');
const DEPS_SCRIPT = path.join(__dirname, '..', 'skills', 'skillet-setup', 'scripts', 'install-deps.sh');

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
  { value: 'jira-mcp', label: 'Atlassian (Jira) MCP server', hint: 'claude mcp add atlassian' },
  { value: 'glab', label: 'glab CLI', hint: 'GitLab CLI' },
];
const JIRA_SKILLS = new Set(['grill-me', 'grill-with-docs', 'to-prd', 'to-issues', 'handoff', 'ralph-once', 'jira-ralph']);
const ALL = [...SKILLS.map((s) => s.value), ...DEPS.map((d) => d.value)];

function parseArgs(argv) {
  const args = { yes: false, only: null, skip: new Set(), domain: null, project: null, dest: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-y' || a === '--yes') args.yes = true;
    else if (a === '--only') args.only = argv[++i].split(',');
    else if (a === '--skip') argv[++i].split(',').forEach((s) => args.skip.add(s));
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
      --jira-domain X    Jira domain (default: xcelore.atlassian.net)
      --jira-project X   Jira project key (default: XW)
      --dest global|project   skills dir (default: global)

Items: ${ALL.join(', ')}`);
      process.exit(0);
    }
  }
  return args;
}

function bail(msg) {
  p.cancel(msg ?? 'Cancelled.');
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  p.intro('🍳 skillet — agent workflow installer');

  // --- selection ---
  let selected;
  if (args.yes || args.only) {
    selected = (args.only ?? ALL).filter((v) => !args.skip.has(v));
    const unknown = selected.filter((v) => !ALL.includes(v));
    if (unknown.length) bail(`Unknown items: ${unknown.join(', ')}`);
  } else {
    const picked = await p.multiselect({
      message: 'What to install? (all selected — uncheck to opt out)',
      options: [...SKILLS, ...DEPS],
      initialValues: ALL.filter((v) => !args.skip.has(v)),
      required: false,
    });
    if (p.isCancel(picked)) bail();
    selected = picked;
  }
  if (!selected.length) bail('Nothing selected.');

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
        { value: 'global', label: 'Global — ~/.claude/skills (every project)' },
        { value: 'project', label: 'Project — ./.claude/skills (this repo only)' },
      ],
      initialValue: 'global',
    });
    if (p.isCancel(d)) bail();
    destChoice = d;
  }
  const destDir =
    destChoice === 'global'
      ? path.join(os.homedir(), '.claude', 'skills')
      : path.join(process.cwd(), '.claude', 'skills');

  // --- install skills ---
  const skillsToInstall = selected.filter((v) => SKILLS.some((s) => s.value === v));
  const installed = [];
  const skipped = [];

  for (const name of skillsToInstall) {
    const target = path.join(destDir, name);
    if (fs.existsSync(path.join(target, 'SKILL.md'))) {
      let overwrite = args.yes; // --yes overwrites; interactive asks
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
    installed.push(name);
  }

  // ralph scripts → project root
  if (installed.includes('ralph-once')) {
    for (const f of ['ralph-once.sh', 'afk-ralph.sh']) {
      const dst = path.join(process.cwd(), f);
      fs.copyFileSync(path.join(BUNDLED, 'ralph-once', f), dst);
      fs.chmodSync(dst, 0o755);
    }
    const progress = path.join(process.cwd(), 'progress.txt');
    if (!fs.existsSync(progress)) fs.writeFileSync(progress, '');
  }

  // --- system deps ---
  const depResults = [];
  for (const dep of ['glab', 'jira-mcp'].filter((d) => selected.includes(d))) {
    const s = p.spinner();
    s.start(`Installing ${dep}…`);
    try {
      execFileSync('bash', [DEPS_SCRIPT, dep === 'glab' ? '--glab' : '--mcp'], { stdio: 'pipe' });
      s.stop(`${dep} ✔`);
      depResults.push(`${dep}: ok`);
    } catch (e) {
      s.stop(`${dep} ✘`);
      depResults.push(`${dep}: FAILED — run manually: bash ${DEPS_SCRIPT} --${dep === 'glab' ? 'glab' : 'mcp'}`);
      if (e.stderr) console.error(String(e.stderr).trim());
    }
  }

  // --- summary ---
  const lines = [];
  if (installed.length) lines.push(`Skills → ${destDir}: ${installed.join(', ')}`);
  if (skipped.length) lines.push(`Skipped (already present): ${skipped.join(', ')}`);
  if (wantsJira) lines.push(`Jira: ${domain} / ${project}`);
  lines.push(...depResults);
  p.note(lines.join('\n'), 'Installed');

  p.outro(
    'Next: run /mcp in Claude Code (Atlassian OAuth) · glab auth login · restart Claude Code session.\n' +
      '   Workflow: /grill-me <jira-url> → /to-prd → /to-issues → /jira-ralph <KEY>',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
