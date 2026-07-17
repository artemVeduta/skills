import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const MANIFESTS = [
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
];

export const SUMMARIES_DIR = 'tools/benchmarks/summaries';

const TAG_RE = /^v\d+\.\d+\.\d+$/;

export function validateTag(tag) {
  return typeof tag === 'string' && TAG_RE.test(tag);
}

export function parseArgs(argv) {
  const positional = argv.filter((a) => !a.startsWith('--'));
  return {
    tag: positional[0],
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
  };
}

export function bumpManifest(path, version, { dryRun } = {}) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { path, status: 'missing' };
    throw err;
  }

  const data = JSON.parse(raw);
  const previous = data.version;
  if (previous === version) return { path, status: 'unchanged', previous };

  const indentMatch = raw.match(/^\s*\{\s*\n([ \t]+)/);
  const indent = indentMatch ? indentMatch[1] : 2;
  const trailingNewline = raw.endsWith('\n');

  data.version = version;
  let out = JSON.stringify(data, null, indent);
  if (trailingNewline) out += '\n';

  if (!dryRun) writeFileSync(path, out);
  return { path, status: 'changed', previous, next: version };
}

export function checkBenchmarkStaleness(summariesDir) {
  let files = [];
  try {
    files = readdirSync(summariesDir).filter((f) => f.endsWith('.json'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  if (files.length === 0) {
    return `no committed full-preset benchmark summaries found under ${summariesDir}; ` +
      'skipping baseline freshness check (benchmark harness not yet built)';
  }
  return null;
}

export function planReleaseSteps({ tag, branch, changed }) {
  const steps = [];
  if (changed.length > 0) {
    steps.push(`git add ${changed.join(' ')}`);
    steps.push(`git commit -m "Release ${tag}"`);
  } else {
    steps.push('(no manifest changes to commit)');
  }
  steps.push(`git tag -a ${tag} -m "${tag}"`);
  steps.push(`git push origin ${branch}`);
  steps.push(`git push origin refs/tags/${tag}`);
  steps.push(`gh release create ${tag} --verify-tag --title "${tag}" --generate-notes`);
  return steps;
}

// --- orchestration (side effects) ---------------------------------------

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function git(args) {
  const res = spawnSync('git', args, { encoding: 'utf8' });
  return res.status === 0 ? res.stdout.trim() : null;
}

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: 'inherit' });
  if (res.error && res.error.code === 'ENOENT') fail(`${cmd} not found`);
  if (res.status !== 0) process.exit(res.status || 1);
  return res;
}

function preflight({ tag, dryRun, force }) {
  if (!validateTag(tag)) fail(`tag must be semver-shaped vX.Y.Z (got: ${tag ?? '<none>'})`);
  if (git(['rev-parse', '--is-inside-work-tree']) !== 'true') fail('not inside a git work tree');
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (!branch || branch === 'HEAD') fail('detached HEAD — check out a branch before releasing');
  if (!git(['remote', 'get-url', 'origin'])) fail('no "origin" remote configured');
  if (!force && !dryRun) {
    const dirty = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).stdout.trim();
    if (dirty) fail('working tree is dirty — commit or stash first (or pass --force)');
  }
  if (!dryRun) {
    if (spawnSync('gh', ['--version']).error?.code === 'ENOENT') {
      fail('gh CLI not found — install from https://cli.github.com');
    }
    if (spawnSync('gh', ['auth', 'status'], { stdio: 'ignore' }).status !== 0) {
      fail('gh is not authenticated — run `gh auth login`');
    }
  }
  return { branch };
}

export function main(argv) {
  const { tag, dryRun, force } = parseArgs(argv);
  const { branch } = preflight({ tag, dryRun, force });
  const version = tag.replace(/^v/, '');

  const results = MANIFESTS.map((p) => bumpManifest(p, version, { dryRun }));
  for (const r of results) {
    if (r.status === 'missing') console.warn(`warn: ${r.path} does not exist yet — skipping`);
    else if (r.status === 'unchanged') console.log(`= ${r.path} already at ${version}`);
    else console.log(`~ ${r.path}  version: "${r.previous}" -> "${r.next}"`);
  }

  const warning = checkBenchmarkStaleness(SUMMARIES_DIR);
  if (warning) console.warn(`warn: ${warning}`);

  const changed = results.filter((r) => r.status === 'changed').map((r) => r.path);
  const steps = planReleaseSteps({ tag, branch, changed });

  if (dryRun) {
    console.log('\n[dry-run] would run:');
    for (const s of steps) console.log('  ' + s);
    return;
  }

  if (changed.length > 0) {
    run('git', ['add', ...changed]);
    run('git', ['commit', '-m', `Release ${tag}`]);
  }

  const tagExists = spawnSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`]).status === 0;
  if (tagExists && !force) console.log(`notice: tag ${tag} already exists — not re-tagging`);
  else run('git', ['tag', '-a', tag, '-m', tag, ...(force ? ['--force'] : [])]);

  run('git', ['push', 'origin', branch]);
  run('git', ['push', 'origin', `refs/tags/${tag}`]);

  const releaseExists = spawnSync('gh', ['release', 'view', tag], { stdio: 'ignore' }).status === 0;
  if (releaseExists) console.log(`notice: GitHub release ${tag} already exists — skipping create`);
  else run('gh', ['release', 'create', tag, '--verify-tag', '--title', tag, '--generate-notes']);

  console.log(`\nReleased ${tag}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
