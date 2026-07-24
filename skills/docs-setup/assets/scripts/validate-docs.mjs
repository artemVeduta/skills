#!/usr/bin/env node
// Strict OKF v0.1 conformance validator for the docs/ bundle.
// Exit contract (no flags, no alternate strict entrypoint):
//   0 — clean, or warnings only;
//   1 — one or more hard bundle errors;
//   2 — validator malfunction (e.g. missing/unreadable docs root).
// Hard ERRORS are exactly the OKF conformance floor: unparseable frontmatter
// (a YAML 1.2 mapping between standalone `---` delimiters, opening delimiter on
// the first line) and a missing/empty/non-scalar `type`. Everything else is a
// non-blocking WARNING. Every .md file under the bundle root is validated
// uniformly; non-Markdown sidecars are ignored; there is no exclusion or
// suppression grammar. See docs/conventions/documentation.md.

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const reservedFiles = new Set(['index.md', 'log.md']);
export const recommendedFields = ['title', 'description', 'timestamp'];
const isoRe = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;
const logHeadingRe = /^## \d{4}-\d{2}-\d{2}$/;
const amendmentHeadingRe = /^## (\d{4}-\d{2}-\d{2})(?: — \S.*)?$/;

// ---------------------------------------------------------------------------
// Frontmatter oracle — a self-contained parser for the YAML 1.2 subset used by
// concept frontmatter: block mappings and sequences, single-line flow
// collections, plain scalars (including multi-line continuation lines folded
// with single spaces), quoted and block scalars, comments. Anything outside
// the subset (anchors, aliases, tags, multi-line quoted scalars, multi-line
// flow collections) is rejected as unparseable — deliberately, so the oracle
// stays dependency-free while still rejecting invalid YAML, duplicate keys,
// and non-mapping documents. The subset is documented in
// docs/docs-setup/specs/validator.md.
// ---------------------------------------------------------------------------

class YamlError extends Error {}

function isBlankOrComment(line) {
  return /^[ \t]*(#.*)?$/.test(line);
}

function indentOf(line) {
  let i = 0;
  while (i < line.length && line[i] === ' ') i += 1;
  if (line[i] === '\t') throw new YamlError('tab indentation is not allowed');
  return i;
}

function skipSpaces(s, i) {
  while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i += 1;
  return i;
}

function resolvePlain(raw) {
  if (/^(~|null|Null|NULL)$/.test(raw)) return null;
  if (/^(true|True|TRUE)$/.test(raw)) return true;
  if (/^(false|False|FALSE)$/.test(raw)) return false;
  if (/^[-+]?[0-9]+$/.test(raw)) return parseInt(raw, 10);
  if (/^0o[0-7]+$/.test(raw)) return parseInt(raw.slice(2), 8);
  if (/^0x[0-9a-fA-F]+$/.test(raw)) return parseInt(raw.slice(2), 16);
  if (
    /^[-+]?([0-9]+\.[0-9]*|\.[0-9]+)([eE][-+]?[0-9]+)?$/.test(raw) ||
    /^[-+]?[0-9]+[eE][-+]?[0-9]+$/.test(raw)
  ) {
    return parseFloat(raw);
  }
  if (/^[-+]?\.(inf|Inf|INF)$/.test(raw)) return raw.startsWith('-') ? -Infinity : Infinity;
  if (/^\.(nan|NaN|NAN)$/.test(raw)) return NaN;
  return raw;
}

function parseQuoted(s, i) {
  const q = s[i];
  let out = '';
  let j = i + 1;
  while (j < s.length) {
    const ch = s[j];
    if (q === "'") {
      if (ch === "'") {
        if (s[j + 1] === "'") {
          out += "'";
          j += 2;
          continue;
        }
        return [out, j + 1];
      }
      out += ch;
      j += 1;
    } else {
      if (ch === '\\') {
        const esc = s[j + 1];
        if (esc === undefined) throw new YamlError('bad escape in double-quoted scalar');
        const map = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', 0: '\0' };
        out += map[esc] ?? esc;
        j += 2;
        continue;
      }
      if (ch === '"') return [out, j + 1];
      out += ch;
      j += 1;
    }
  }
  throw new YamlError('unterminated quoted scalar (quoted scalars must close on the same line)');
}

// Scan a plain scalar starting at i; returns [raw, end]. Throws on the ": "
// that would start a nested mapping value mid-scalar.
function scanPlain(s, i, inFlow) {
  let end = i;
  while (end < s.length) {
    const ch = s[end];
    if (inFlow && (ch === ',' || ch === ']' || ch === '}')) break;
    if (ch === '#' && end > i && /[ \t]/.test(s[end - 1])) break;
    if (
      ch === ':' &&
      (end + 1 === s.length ||
        /[ \t]/.test(s[end + 1]) ||
        (inFlow && ',]}'.includes(s[end + 1])))
    ) {
      throw new YamlError('unexpected ":" inside a plain scalar (quote the value)');
    }
    end += 1;
  }
  const raw = s.slice(i, end).trim();
  if (raw === '') throw new YamlError('empty plain scalar');
  return [raw, end];
}

function parseFlowValue(s, i, inFlow) {
  i = skipSpaces(s, i);
  const c = s[i];
  if (c === undefined) {
    throw new YamlError(
      inFlow ? 'unterminated flow collection (flow collections must close on the same line)' : 'missing value'
    );
  }
  if (c === '[') return parseFlowSeq(s, i);
  if (c === '{') return parseFlowMap(s, i);
  if (c === '"' || c === "'") return parseQuoted(s, i);
  if ('&*!@`%'.includes(c)) {
    throw new YamlError(
      `unsupported YAML indicator "${c}" (anchors, aliases, and tags are outside the supported YAML subset)`
    );
  }
  const [raw, end] = scanPlain(s, i, inFlow);
  return [resolvePlain(raw), end];
}

function parseFlowSeq(s, i) {
  const out = [];
  let j = skipSpaces(s, i + 1);
  if (s[j] === ']') return [out, j + 1];
  for (;;) {
    const [v, next] = parseFlowValue(s, j, true);
    out.push(v);
    j = skipSpaces(s, next);
    if (s[j] === ',') {
      j = skipSpaces(s, j + 1);
      if (s[j] === ']') return [out, j + 1];
      continue;
    }
    if (s[j] === ']') return [out, j + 1];
    throw new YamlError('unterminated flow sequence (flow collections must close on the same line)');
  }
}

function parseFlowMap(s, i) {
  // Built as a Map so "__proto__" is an ordinary key (a plain object would
  // silently drop it and let a duplicate evade the check below).
  const out = new Map();
  let j = skipSpaces(s, i + 1);
  if (s[j] === '}') return [Object.fromEntries(out), j + 1];
  for (;;) {
    let key;
    if (s[j] === '"' || s[j] === "'") {
      [key, j] = parseQuoted(s, j);
    } else {
      let e = j;
      while (e < s.length && !':,}'.includes(s[e])) e += 1;
      key = s.slice(j, e).trim();
      if (key === '') throw new YamlError('empty flow mapping key');
      j = e;
    }
    j = skipSpaces(s, j);
    if (s[j] !== ':') throw new YamlError('missing ":" in flow mapping');
    j = skipSpaces(s, j + 1);
    const [v, next] = parseFlowValue(s, j, true);
    if (out.has(key)) {
      throw new YamlError(`duplicate key "${key}"`);
    }
    out.set(key, v);
    j = skipSpaces(s, next);
    if (s[j] === ',') {
      j = skipSpaces(s, j + 1);
      if (s[j] === '}') return [Object.fromEntries(out), j + 1];
      continue;
    }
    if (s[j] === '}') return [Object.fromEntries(out), j + 1];
    throw new YamlError('unterminated flow mapping (flow collections must close on the same line)');
  }
}

function nextSignificant(ctx) {
  while (ctx.pos < ctx.lines.length && isBlankOrComment(ctx.lines[ctx.pos])) ctx.pos += 1;
  return ctx.pos < ctx.lines.length ? ctx.lines[ctx.pos] : null;
}

function readBlockScalar(ctx, indent) {
  const collected = [];
  while (ctx.pos < ctx.lines.length) {
    const line = ctx.lines[ctx.pos];
    if (/^[ \t]*$/.test(line)) {
      collected.push('');
      ctx.pos += 1;
      continue;
    }
    const li = indentOf(line);
    if (li <= indent) break;
    collected.push(line.slice(li));
    ctx.pos += 1;
  }
  while (collected.length && collected[collected.length - 1] === '') collected.pop();
  return collected.join('\n');
}

function parseInlineValue(ctx, rest, indent) {
  const trimmed = rest.trim();
  if (/^[|>][+-]?[0-9]?$/.test(trimmed)) {
    ctx.pos += 1;
    return readBlockScalar(ctx, indent);
  }
  if (!'"\'[{&*!@`%'.includes(trimmed[0])) {
    // Plain scalar. Per YAML 1.2 it may continue onto following lines indented
    // deeper than its key; continuation lines fold with single spaces. A blank
    // or comment line ends the scalar (blank-line folding is outside the
    // supported subset).
    let [folded] = scanPlain(rest, skipSpaces(rest, 0), false);
    ctx.pos += 1;
    for (;;) {
      const line = ctx.lines[ctx.pos];
      if (line === undefined || isBlankOrComment(line)) break;
      const li = indentOf(line);
      if (li <= indent) break;
      folded += ` ${scanPlain(line, li, false)[0]}`;
      ctx.pos += 1;
    }
    return resolvePlain(folded);
  }
  const [value, next] = parseFlowValue(rest, 0, false);
  const tail = rest.slice(next);
  if (!/^[ \t]*(#.*)?$/.test(tail)) {
    throw new YamlError(`trailing content after value: "${tail.trim()}"`);
  }
  ctx.pos += 1;
  return value;
}

function parseChildBlock(ctx, parentIndent) {
  const line = nextSignificant(ctx);
  if (line === null) return null;
  const li = indentOf(line);
  if (li > parentIndent) return parseBlock(ctx, li);
  if (li === parentIndent) {
    const content = line.slice(li);
    // YAML permits a block sequence at the same indent as its mapping key.
    if (content === '-' || content.startsWith('- ')) return parseSequence(ctx, li);
  }
  return null;
}

const KEY_RE = /^([^\s'"#][^:]*?|'[^']*'|"[^"]*")[ \t]*:(?:[ \t]+(.*))?$/;

function parseMapping(ctx, indent) {
  // Built as a Map so "__proto__" is an ordinary key (a plain object would
  // silently drop it and let a duplicate evade the check below).
  const out = new Map();
  for (;;) {
    const line = nextSignificant(ctx);
    if (line === null) break;
    const li = indentOf(line);
    if (li < indent) break;
    if (li > indent) {
      throw new YamlError(
        `bad indentation: "${line.trim()}" (multi-line quoted scalars and flow collections are outside the supported YAML subset)`
      );
    }
    const content = line.slice(li);
    if (content === '-' || content.startsWith('- ')) {
      throw new YamlError('sequence entry in mapping context');
    }
    const m = content.match(KEY_RE);
    if (!m) throw new YamlError(`invalid mapping entry: "${content}"`);
    let key = m[1];
    if (/^['"]/.test(key)) key = key.slice(1, -1);
    if (out.has(key)) {
      throw new YamlError(`duplicate key "${key}"`);
    }
    const rest = m[2];
    if (rest === undefined || rest.trim() === '' || rest.trim().startsWith('#')) {
      ctx.pos += 1;
      out.set(key, parseChildBlock(ctx, indent));
    } else {
      out.set(key, parseInlineValue(ctx, rest, indent));
    }
  }
  return Object.fromEntries(out);
}

function parseSequence(ctx, indent) {
  const out = [];
  for (;;) {
    const line = nextSignificant(ctx);
    if (line === null) break;
    const li = indentOf(line);
    if (li < indent) break;
    if (li > indent) throw new YamlError(`bad indentation: "${line.trim()}"`);
    const content = line.slice(li);
    if (content !== '-' && !content.startsWith('- ')) break;
    if (content === '-') {
      ctx.pos += 1;
      const child = nextSignificant(ctx);
      out.push(child !== null && indentOf(child) > indent ? parseBlock(ctx, indentOf(child)) : null);
    } else {
      const rest = content.slice(2);
      if (KEY_RE.test(rest.trimEnd())) {
        // "- key: value" — a mapping nested in a sequence entry.
        ctx.lines[ctx.pos] = ' '.repeat(indent + 2) + rest;
        out.push(parseMapping(ctx, indent + 2));
      } else {
        out.push(parseInlineValue(ctx, rest, indent));
      }
    }
  }
  return out;
}

function parseBlock(ctx, indent) {
  const line = ctx.lines[ctx.pos];
  const content = line.slice(indent);
  if (content === '-' || content.startsWith('- ')) return parseSequence(ctx, indent);
  return parseMapping(ctx, indent);
}

function parseYamlDocument(text) {
  const ctx = { lines: text.split(/\r?\n/), pos: 0 };
  const first = nextSignificant(ctx);
  if (first === null) return null;
  const value = parseBlock(ctx, indentOf(first));
  const trailing = nextSignificant(ctx);
  if (trailing !== null) throw new YamlError(`unexpected content: "${trailing.trim()}"`);
  return value;
}

export function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (!/^---\s*$/.test(lines[0] ?? '')) {
    return { ok: false, reason: 'missing opening --- delimiter on the first line' };
  }
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (/^---\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { ok: false, reason: 'unterminated frontmatter (no closing ---)' };
  }
  let doc;
  try {
    doc = parseYamlDocument(lines.slice(1, end).join('\n'));
  } catch (err) {
    return { ok: false, reason: `invalid YAML frontmatter: ${err.message}` };
  }
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, reason: 'frontmatter is not a YAML mapping' };
  }
  return { ok: true, data: doc, body: lines.slice(end + 1).join('\n') };
}

// ---------------------------------------------------------------------------
// Concept and reserved-file checks
// ---------------------------------------------------------------------------

// Newest exact `## YYYY-MM-DD` / `## YYYY-MM-DD — <title>` heading inside the
// region opened by an exact level-one `# Amendments` heading and closed by the
// next level-one heading or EOF. Lookalike headings outside the region or
// inside fenced code (text in a fence is not a Markdown heading) are ignored.
function newestAmendmentDate(body) {
  let inRegion = false;
  let newest = null;
  for (const line of stripCode(body).split(/\r?\n/)) {
    if (/^#(?:[ \t]|$)/.test(line)) {
      inRegion = line === '# Amendments';
      continue;
    }
    if (!inRegion) continue;
    const m = line.match(amendmentHeadingRe);
    if (m && (newest === null || m[1] > newest)) newest = m[1];
  }
  return newest;
}

export function validateConcept(relPath, text) {
  const errors = [];
  const warnings = [];
  const fm = parseFrontmatter(text);
  if (!fm.ok) {
    errors.push(`${relPath}: ${fm.reason}`);
    return { errors, warnings };
  }
  const type = fm.data.type;
  if (typeof type !== 'string' || type.trim() === '') {
    errors.push(`${relPath}: \`type\` must be a non-empty scalar string`);
  }
  for (const field of recommendedFields) {
    const v = fm.data[field];
    const present =
      typeof v === 'string' ? v.trim() !== '' : v !== undefined && v !== null;
    if (!present) warnings.push(`${relPath}: missing recommended field \`${field}\``);
  }
  const ts = fm.data.timestamp;
  if (ts !== undefined && ts !== null) {
    if (typeof ts !== 'string' || !isoRe.test(ts)) {
      warnings.push(`${relPath}: \`timestamp\` "${ts}" is not ISO 8601`);
    } else {
      const newest = newestAmendmentDate(fm.body);
      const day = ts.slice(0, 10);
      if (newest !== null && day < newest) {
        warnings.push(
          `${relPath}: \`timestamp\` ${day} is older than the newest \`# Amendments\` entry ${newest}`
        );
      }
    }
  }
  if (fm.data.status === 'superseded') {
    const sb = fm.data.superseded_by;
    if (typeof sb !== 'string' || sb.trim() === '') {
      warnings.push(`${relPath}: status superseded but no \`superseded_by\``);
    }
  }
  return { errors, warnings };
}

export function validateReserved(relPath, text, isRoot) {
  // Reserved-file checks emit only warnings, but the symmetric { errors, warnings }
  // shape is deliberate so validateBundle can spread both branches identically.
  const errors = [];
  const warnings = [];
  const base = relPath.split('/').pop();
  const hasFm = /^---\s*$/.test(text.split(/\r?\n/)[0] ?? '');
  if (base === 'index.md') {
    if (hasFm && !isRoot) {
      warnings.push(`${relPath}: non-root index.md must not carry frontmatter (OKF §6)`);
    }
    if (isRoot && hasFm) {
      const fm = parseFrontmatter(text);
      if (!fm.ok || fm.data.okf_version !== '0.1') {
        warnings.push(
          `${relPath}: root index.md frontmatter must declare string okf_version: "0.1"`
        );
      }
    }
  }
  if (base === 'log.md') {
    for (const line of text.split(/\r?\n/)) {
      if (/^##(?!#)/.test(line) && !logHeadingRe.test(line)) {
        warnings.push(
          `${relPath}: log.md heading "${line.replace(/^##[ \t]*/, '').trim()}" is not exact \`## YYYY-MM-DD\``
        );
      }
    }
  }
  return { errors, warnings };
}

// Strip fenced code blocks (``` or ~~~) and inline code spans so illustrative
// content inside code (link placeholders, example amendment headings) is not
// scanned. Per CommonMark the closing fence may be longer than the opener; an
// unclosed fence runs to EOF.
function stripCode(text) {
  const kept = [];
  let open = null; // { ch, len } of the open fence
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^[ \t]*(`{3,}|~{3,})(.*)$/);
    if (open) {
      if (m && m[1][0] === open.ch && m[1].length >= open.len && m[2].trim() === '') {
        open = null;
      }
      continue;
    }
    // A backtick fence's info string may not contain backticks (CommonMark).
    if (m && !(m[1][0] === '`' && m[2].includes('`'))) {
      open = { ch: m[1][0], len: m[1].length };
      continue;
    }
    kept.push(line);
  }
  return kept.join('\n').replace(/(`+)[^\n]*?\1/g, '');
}

// Bundle-absolute Markdown link targets in text (leading slash stripped),
// with fenced code and inline code spans removed first.
function bundleLinkTargets(text) {
  const out = [];
  for (const m of stripCode(text).matchAll(/\]\((\/[^)\s#]+)(#[^)\s]*)?\)/g)) {
    out.push(m[1].replace(/^\//, ''));
  }
  return out;
}

export function checkLinks(relPath, text, allRelPaths) {
  const warnings = [];
  for (const target of bundleLinkTargets(text)) {
    if (target.endsWith('.md') && !allRelPaths.has(target)) {
      warnings.push(`${relPath}: broken internal link -> /${target}`);
    }
  }
  return warnings;
}

function toPosixRel(rootDir, file) {
  return relative(rootDir, file).split(sep).join('/');
}

function posixDir(rel) {
  const idx = rel.lastIndexOf('/');
  return idx === -1 ? '' : rel.slice(0, idx);
}

export async function walkDocs(rootDir) {
  const out = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile() && e.name.endsWith('.md')) {
        out.push(full);
      }
    }
  }
  await walk(rootDir);
  return out;
}

// One aggregated warning per index: concepts in the same directory that the
// index does not link by exact bundle-relative path — total count plus the
// first three omitted paths in lexicographic order. A cross-directory link to
// a same-basename concept does not satisfy coverage.
export function indexCoverageWarnings(indexRel, indexText, conceptRelPaths) {
  const linked = new Set(bundleLinkTargets(indexText));
  const missing = conceptRelPaths.filter((p) => !linked.has(p)).sort();
  if (missing.length === 0) return [];
  const shown = missing
    .slice(0, 3)
    .map((p) => `/${p}`)
    .join(', ');
  return [
    `${indexRel}: ${missing.length} concept(s) not linked by exact bundle path (first ${Math.min(3, missing.length)}: ${shown})`,
  ];
}

// Coverage is checked against the texts already read during the walk — one
// snapshot of the tree, no second read. A directory whose index.md is absent
// from the walked set has no local index.
function checkIndexCoverage(texts, conceptDirs) {
  const warnings = [];
  for (const [dir, rels] of conceptDirs) {
    const indexRel = dir ? `${dir}/index.md` : 'index.md';
    const indexText = texts.get(indexRel);
    if (indexText === undefined) {
      warnings.push(`${dir || '(root)'}: directory has concepts but no index.md`);
      continue;
    }
    warnings.push(...indexCoverageWarnings(indexRel, indexText, rels));
  }
  return warnings;
}

export async function validateBundle(rootDir) {
  const files = await walkDocs(rootDir);
  const errors = [];
  const warnings = [];
  const texts = new Map();
  for (const file of files) {
    texts.set(toPosixRel(rootDir, file), await readFile(file, 'utf8'));
  }
  const allRelPaths = new Set(texts.keys());
  const conceptDirs = new Map();
  for (const [rel, text] of texts) {
    const base = rel.split('/').pop();
    // Links are checked everywhere — index.md is the navigation backbone.
    warnings.push(...checkLinks(rel, text, allRelPaths));
    if (reservedFiles.has(base)) {
      const r = validateReserved(rel, text, rel === 'index.md');
      errors.push(...r.errors);
      warnings.push(...r.warnings);
    } else {
      const r = validateConcept(rel, text);
      errors.push(...r.errors);
      warnings.push(...r.warnings);
      const dir = posixDir(rel);
      if (!conceptDirs.has(dir)) conceptDirs.set(dir, []);
      conceptDirs.get(dir).push(rel);
    }
  }
  warnings.push(...checkIndexCoverage(texts, conceptDirs));
  return { errors, warnings };
}

export function formatReport({ errors, warnings }) {
  if (errors.length === 0 && warnings.length === 0) {
    return 'docs:validate — OKF bundle conformant; no warnings.';
  }
  const lines = [];
  if (errors.length > 0) {
    lines.push(`ERRORS — OKF §9 conformance (${errors.length}):`);
    for (const e of errors) lines.push(`  ${e}`);
    lines.push('');
  }
  if (warnings.length > 0) {
    lines.push(`Warnings — recommended/soft (${warnings.length}):`);
    for (const w of warnings) lines.push(`  ${w}`);
    lines.push('');
  }
  lines.push(
    `${errors.length} hard failure(s), ${warnings.length} warning(s). Exit: 0 clean/warnings-only, 1 hard errors, 2 malfunction.`
  );
  return lines.join('\n');
}

// Single source of the malfunction report; returns the exit code so both
// failure paths (validateBundle throwing, main itself rejecting) stay aligned.
function reportMalfunction(err) {
  console.error(`docs:validate — validator malfunction: ${err?.message ?? err}`);
  return 2;
}

async function main() {
  const root = process.argv[2] || 'docs';
  let result;
  try {
    result = await validateBundle(root);
  } catch (err) {
    return reportMalfunction(err);
  }
  console.log(formatReport(result));
  return result.errors.length > 0 ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then(
    (code) => process.exit(code),
    (err) => process.exit(reportMalfunction(err))
  );
}
