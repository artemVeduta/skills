export function parseRequiredSkills(body) {
  const names = [];
  let inSection = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^##\s+/.test(line)) {
      inSection = /^##\s+Required skills\s*$/.test(line);
      continue;
    }
    if (!inSection) continue;
    const m = line.match(/^\s*[-*]\s+`?([a-z0-9][a-z0-9-]*)`?\s*$/);
    if (m) names.push(m[1]);
  }
  return names;
}

export function parseRuntimeInvocations(body) {
  const names = new Set();
  for (const m of body.matchAll(/`\/([a-z0-9][a-z0-9-]*)`/g)) {
    names.add(m[1]);
  }
  return [...names];
}

export function reconcileInvocations(declared, invoked) {
  const declaredSet = new Set(declared);
  return invoked.filter((name) => !declaredSet.has(name));
}

export function missingNodes(graph) {
  const out = [];
  for (const [from, requires] of graph) {
    for (const dep of requires) {
      if (!graph.has(dep)) out.push({ from, missing: dep });
    }
  }
  return out;
}

export function findCycles(graph) {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map([...graph.keys()].map((n) => [n, WHITE]));
  const stack = [];
  const cycles = [];

  function visit(node) {
    color.set(node, GRAY);
    stack.push(node);
    for (const dep of graph.get(node) || []) {
      if (!graph.has(dep)) continue;
      if (color.get(dep) === GRAY) {
        cycles.push(stack.slice(stack.indexOf(dep)));
      } else if (color.get(dep) === WHITE) {
        visit(dep);
      }
    }
    stack.pop();
    color.set(node, BLACK);
  }

  for (const name of graph.keys()) {
    if (color.get(name) === WHITE) visit(name);
  }
  return cycles;
}

export function transitiveClosure(graph, start) {
  const closure = new Set();
  const queue = [start];
  while (queue.length > 0) {
    const node = queue.shift();
    if (closure.has(node)) continue;
    closure.add(node);
    for (const dep of graph.get(node) || []) {
      if (!closure.has(dep)) queue.push(dep);
    }
  }
  return closure;
}
