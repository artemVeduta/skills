import { parseRequiredSkills, missingNodes, findCycles } from '../../tools/skill-graph.mjs';
import { stripFrontmatter } from './discovery.mjs';

// Map<skill name, required skill names> built exactly as the linter builds it.
export function buildGraph(skills) {
  const graph = new Map();
  for (const s of skills) graph.set(s.name, parseRequiredSkills(stripFrontmatter(s.text)));
  return graph;
}

// Detect missing canonical dependencies and cycles; each defect names the skill.
export function validateGraph(graph) {
  const defects = [];
  for (const { from, missing } of missingNodes(graph)) {
    defects.push({
      type: 'missing',
      skill: from,
      detail: missing,
      message: `skill "${from}" requires "${missing}", which does not exist in the library`,
    });
  }
  for (const cycle of findCycles(graph)) {
    const chain = [...cycle, cycle[0]].join(' -> ');
    defects.push({ type: 'cycle', skill: cycle[0], detail: chain, message: `dependency cycle: ${chain}` });
  }
  return { ok: defects.length === 0, defects };
}
