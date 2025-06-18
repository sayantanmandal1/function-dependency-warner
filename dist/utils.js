"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flattenDependencies = flattenDependencies;
function flattenDependencies(graph, root) {
    const visited = new Set();
    const stack = [root];
    const result = [];
    while (stack.length > 0) {
        const current = stack.pop();
        if (!current || visited.has(current))
            continue;
        visited.add(current);
        const deps = graph[current] || [];
        result.push(...deps);
        stack.push(...deps);
    }
    return Array.from(new Set(result));
}
