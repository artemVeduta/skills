export const ALLOWED_KEYS = new Set([
  'name',
  'description',
  'disable-model-invocation',
  'argument-hint',
]);

export const CANONICAL_HEADINGS = [
  '## Overview',
  '## Required skills',
  '## Integration',
  '## When to Use',
  '## Common Mistakes',
  '## Quick Reference',
];

export const ROLE_SUBDIRS = new Set(['scripts', 'templates', 'assets']);

export function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0].trim() !== '---') {
    return { ok: false, reason: 'no opening --- frontmatter fence' };
  }
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { ok: false, reason: 'unterminated frontmatter (no closing ---)' };
  }
  const data = {};
  for (let i = 1; i < end; i += 1) {
    const m = lines[i].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    data[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return { ok: true, data, body: lines.slice(end + 1).join('\n') };
}

function stripFences(text) {
  return text.replace(/^[ \t]*(`{3,}|~{3,})[\s\S]*?\n[ \t]*\1[ \t]*$/gm, '');
}

export function lintFrontmatter(relPath, data) {
  const errors = [];
  const warnings = [];
  for (const req of ['name', 'description']) {
    if (typeof data[req] !== 'string' || data[req].trim() === '') {
      errors.push(`${relPath}: missing or empty required frontmatter key \`${req}\``);
    }
  }
  if ('disable-model-invocation' in data) {
    const v = data['disable-model-invocation'];
    if (v !== 'true' && v !== 'false') {
      errors.push(`${relPath}: \`disable-model-invocation\` must be true or false, got "${v}"`);
    }
  }
  for (const key of Object.keys(data)) {
    if (!ALLOWED_KEYS.has(key)) {
      warnings.push(
        `${relPath}: unknown frontmatter key \`${key}\` (allowed: name, description, disable-model-invocation, argument-hint)`
      );
    }
  }
  return { errors, warnings };
}

export function lintName(relPath, name, dirName) {
  const errors = [];
  if (name !== dirName) {
    errors.push(`${relPath}: frontmatter name "${name}" != directory name "${dirName}"`);
  }
  return { errors, warnings: [] };
}

export function lintBody(relPath, body) {
  const errors = [];
  const warnings = [];
  const count = body.split('\n').length;
  if (count > 500) {
    errors.push(`${relPath}: body is ${count} lines (> 500 hard limit)`);
  } else if (count > 200) {
    warnings.push(`${relPath}: body is ${count} lines (> 200 soft limit)`);
  }
  return { errors, warnings };
}

export function lintHeadings(relPath, body) {
  const warnings = [];
  const canonicalByLower = new Map(
    CANONICAL_HEADINGS.map((h) => [h.toLowerCase(), h])
  );
  for (const line of stripFences(body).split(/\r?\n/)) {
    if (!/^##\s+\S/.test(line)) continue;
    const heading = line.trim();
    const canonical = canonicalByLower.get(heading.toLowerCase());
    if (canonical && canonical !== heading) {
      warnings.push(`${relPath}: heading "${heading}" is a near-miss of canonical "${canonical}"`);
    }
  }
  return { errors: [], warnings };
}
