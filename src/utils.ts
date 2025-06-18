export function flattenDependencies(graph: Record<string, string[]>, root: string): string[] {
  const visited = new Set<string>();
  const stack = [root];
  const result: string[] = [];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;

    visited.add(current);
    const deps = graph[current] || [];
    result.push(...deps);
    stack.push(...deps);
  }

  return Array.from(new Set(result));
}