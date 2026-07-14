// Loads a central test case from <casesRoot>/<skill>/: a case.mjs manifest
// module (default-exports { skill, inputs, assertions }) plus a prompt.md
// scenario prompt. Cases live under tools/tests/ — never inside skills/ — so no
// test material ships to installs. Each case dir is a unique path so dynamic
// import caching never collides across cases.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadCase(skillName, { casesRoot }) {
  const dir = join(casesRoot, skillName);
  const mod = await import(pathToFileURL(join(dir, 'case.mjs')).href);
  const manifest = mod.default;
  const prompt = await readFile(join(dir, 'prompt.md'), 'utf8');
  return {
    skill: manifest.skill ?? skillName,
    inputs: manifest.inputs ?? [],
    assertions: manifest.assertions ?? [],
    prompt,
  };
}
