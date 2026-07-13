#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { REGISTRY } from './install/registry.mjs';
import { discoverSkills } from './install/discovery.mjs';
import { createInterface } from 'node:readline';
import { findEntry } from './install/registry.mjs';
import { resolveProfile, resolveSkillDir } from './install/profiles.mjs';
import { planTarget } from './install/planner.mjs';
import { renderPreview } from './install/preview.mjs';
import { applyTarget } from './install/linker.mjs';

const EXIT = { OK: 0, HARD: 1, USAGE: 2, NOTHING: 3, GRAPH: 4 };
const REPO_DEFAULT = resolve(fileURLToPath(new URL('..', import.meta.url)));

class UsageError extends Error {}

function usage() {
  return [
    'Usage: install.sh [options]',
    '',
    'Development-links installer: symlinks every library skill into the harness',
    'profiles you select.',
    '',
    'Options:',
    '  --inspect             list discovered skills and registry entries; do not install',
    '  --checkout <dir>      working copy to link from (default: repo root)',
    '  --harness <id>        select a harness by id (repeatable)',
    '  --profile <id[:sel]>  select a harness profile or custom dir (repeatable)',
    '  --scope <global|project>  install scope (default: global)',
    '  --dry-run             show the preview; change nothing',
    '  --yes, -y             skip the confirmation prompt (non-interactive)',
    '  --help, -h            show this help',
  ].join('\n');
}

function parseArgs(argv) {
  const o = { harness: [], profile: [], scope: 'global' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) o.error = `option ${a} requires a value`;
      return v;
    };
    switch (a) {
      case '--help':
      case '-h':
        o.help = true;
        break;
      case '--inspect':
        o.inspect = true;
        break;
      case '--dry-run':
        o.dryRun = true;
        break;
      case '--yes':
      case '-y':
        o.yes = true;
        break;
      case '--harness':
        o.harness.push(value());
        break;
      case '--profile':
        o.profile.push(value());
        break;
      case '--scope':
        o.scope = value();
        break;
      case '--checkout':
        o.checkout = value();
        break;
      default:
        o.error = `unknown option: ${a}`;
    }
    if (o.error) break;
  }
  if (!o.error && !['global', 'project'].includes(o.scope)) o.error = `invalid --scope: ${o.scope}`;
  return o;
}

function printInspect(skills, registry) {
  const lines = ['Discovered skills:'];
  for (const s of skills) lines.push(`  ${s.name}`);
  lines.push('', 'Known harnesses:');
  for (const e of registry) {
    lines.push(`  ${e.id} (${e.displayName}) — scopes: ${e.scopes.join(',')}; channels: ${e.channels.join(',')}`);
  }
  process.stdout.write(lines.join('\n') + '\n');
}

function resolveSelections(registry, o) {
  const out = [];
  const add = (entry, selector) => {
    const profile = resolveProfile(entry, selector);
    if (!profile) throw new UsageError(`unknown profile "${selector}" for harness ${entry.id}`);
    const skillDir = resolveSkillDir(entry, profile, o.scope);
    if (!skillDir) throw new UsageError(`harness ${entry.id} does not support scope ${o.scope}`);
    out.push({ entry, profile, scope: o.scope, skillDir });
  };
  for (const spec of o.profile) {
    const i = spec.indexOf(':');
    const id = i === -1 ? spec : spec.slice(0, i);
    const selector = i === -1 ? null : spec.slice(i + 1);
    const entry = findEntry(registry, id);
    if (!entry) throw new UsageError(`unknown harness: ${id}`);
    if (selector === null) for (const d of entry.configRoot.defaults) add(entry, d.id);
    else add(entry, selector);
  }
  for (const id of o.harness) {
    const entry = findEntry(registry, id);
    if (!entry) throw new UsageError(`unknown harness: ${id}`);
    for (const d of entry.configRoot.defaults) add(entry, d.id);
  }
  return out;
}

function confirm(promptText = 'Proceed? [y/N] ') {
  process.stdout.write(promptText);
  const rl = createInterface({ input: process.stdin });
  return new Promise((res) => {
    rl.once('line', (line) => {
      res(/^(y|yes)$/i.test(line.trim()));
      rl.close();
    });
    rl.once('close', () => res(false));
  });
}

async function main(argv) {
  const o = parseArgs(argv);
  if (o.help) {
    process.stdout.write(usage() + '\n');
    return EXIT.OK;
  }
  if (o.error) {
    process.stderr.write(`error: ${o.error}\n\n` + usage() + '\n');
    return EXIT.USAGE;
  }

  const checkout = resolve(o.checkout ?? REPO_DEFAULT);
  const registry = REGISTRY;

  const skillsRoot = join(checkout, 'skills');
  const skills = await discoverSkills(skillsRoot);
  if (skills.length === 0) {
    process.stderr.write(`error: no skills discovered under ${skillsRoot}\n`);
    return EXIT.HARD;
  }

  if (o.inspect) {
    printInspect(skills, registry);
    return EXIT.OK;
  }

  // --- Task 3 inserts dependency-graph validation here ---

  let selections;
  try {
    selections = resolveSelections(registry, o);
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`error: ${err.message}\n`);
      return EXIT.USAGE;
    }
    throw err;
  }
  if (selections.length === 0) {
    process.stderr.write('nothing to do: select a harness profile (--harness/--profile) or use --inspect\n');
    return EXIT.NOTHING;
  }

  const targets = [];
  for (const sel of selections) {
    targets.push(await planTarget(sel.entry, sel.profile, sel.scope, skills, sel.skillDir));
  }
  const plan = { skills, targets, warnings: [] };
  process.stdout.write(renderPreview(plan) + '\n');
  if (o.dryRun) return EXIT.OK;

  const ok = o.yes ? true : await confirm();
  if (!ok) {
    process.stdout.write('Aborted; nothing changed.\n');
    return EXIT.OK;
  }
  for (const t of targets) await applyTarget(t);
  process.stdout.write('Done.\n');
  return EXIT.OK;
}

main(process.argv.slice(2)).then((code) => process.exit(code));

export { UsageError };
