#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { REGISTRY } from './install/registry.mjs';
import { discoverSkills } from './install/discovery.mjs';

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
      case '--checkout':
        o.checkout = value();
        break;
      default:
        o.error = `unknown option: ${a}`;
    }
    if (o.error) break;
  }
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
  // --- Task 2 inserts selection + preview + confirmation + apply here ---

  process.stderr.write('nothing to do: select a harness profile (--harness/--profile) or use --inspect\n');
  return EXIT.NOTHING;
}

main(process.argv.slice(2)).then((code) => process.exit(code));

export { UsageError };
