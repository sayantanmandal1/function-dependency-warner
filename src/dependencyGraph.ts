import * as fs from 'fs';
import * as path from 'path';

let graph: Record<string, string[]> = {};

export function loadDependencyGraph(filePath: string) {
  const fullPath = path.resolve(filePath);
  graph = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
}

export function getDependents(funcName: string): string[] {
  const visited = new Set<string>();
  const result: string[] = [];

  function dfs(fn: string) {
    if (visited.has(fn)) return;
    visited.add(fn);
    const deps = graph[fn] || [];
    for (const dep of deps) {
      result.push(dep);
      dfs(dep);
    }
  }

  dfs(funcName);
  return result;
}
