// Deterministic oracle: pass/fail derives ONLY from deterministic state
// assertions (filesystem + structured-output containment). Advisory signal
// (skill-selection evidence, judge scores) is NEVER evaluated here — that is a
// hard rule of the testing architecture.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function readIf(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// ctx: { workdir, repoRoot, output }. Returns one { assertion, pass, detail }
// per assertion, in order.
export async function evaluateAssertions(assertions, ctx) {
  const results = [];
  for (const a of assertions) {
    results.push({ assertion: a, ...(await evaluateOne(a, ctx)) });
  }
  return results;
}

async function evaluateOne(a, { workdir, repoRoot, output }) {
  switch (a.type) {
    case 'file-exists': {
      const c = await readIf(join(workdir, a.path));
      return { pass: c !== null, detail: c !== null ? '' : `missing ${a.path}` };
    }
    case 'file-absent': {
      const c = await readIf(join(workdir, a.path));
      return { pass: c === null, detail: c === null ? '' : `unexpected ${a.path}` };
    }
    case 'file-contains': {
      const c = await readIf(join(workdir, a.path));
      const pass = c !== null && c.includes(a.value);
      return { pass, detail: pass ? '' : `${a.path} does not contain ${JSON.stringify(a.value)}` };
    }
    case 'file-not-contains': {
      const c = await readIf(join(workdir, a.path));
      const pass = c !== null && !c.includes(a.value);
      return { pass, detail: pass ? '' : `${a.path} still contains ${JSON.stringify(a.value)}` };
    }
    case 'file-equals': {
      const actual = await readIf(join(workdir, a.path));
      const expected = await readIf(join(repoRoot, a.against));
      const pass = actual !== null && expected !== null && actual === expected;
      return { pass, detail: pass ? '' : `${a.path} not byte-identical to ${a.against}` };
    }
    case 'output-contains': {
      const pass = typeof output === 'string' && output.includes(a.value);
      return { pass, detail: pass ? '' : `output does not contain ${JSON.stringify(a.value)}` };
    }
    default:
      return { pass: false, detail: `unknown assertion type: ${a.type}` };
  }
}

export function allPassed(results) {
  return results.every((r) => r.pass);
}
