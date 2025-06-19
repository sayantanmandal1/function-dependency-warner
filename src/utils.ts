import * as babelParser from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import * as path from 'path';

export interface FunctionLocation {
  name: string;
  file: string;
  line: number;
  type: string;
}

function parseJSorTS(filePath: string, code: string): FunctionLocation[] {
  const ast = babelParser.parse(code, {
    sourceType: 'unambiguous',
    plugins: ['typescript', 'classProperties'],
  });
  const results: FunctionLocation[] = [];
  traverse(ast, {
    FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
      if (path.node.id && path.node.loc) {
        results.push({
          name: path.node.id.name,
          file: filePath,
          line: path.node.loc.start.line,
          type: 'declaration',
        });
      }
    },
    VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
      if (
        path.node.init &&
        (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init)) &&
        path.node.id.type === 'Identifier' &&
        path.node.loc
      ) {
        results.push({
          name: path.node.id.name,
          file: filePath,
          line: path.node.loc.start.line,
          type: 'arrow',
        });
      }
    },
    ClassMethod(path: NodePath<t.ClassMethod>) {
      if (t.isIdentifier(path.node.key) && path.node.loc) {
        results.push({
          name: path.node.key.name,
          file: filePath,
          line: path.node.loc.start.line,
          type: 'class-method',
        });
      }
    },
  });
  return results;
}

function parseJava(filePath: string, code: string): FunctionLocation[] {
  // Simple regex-based Java method detection
  const results: FunctionLocation[] = [];
  const methodRegex = /(?:public|private|protected)?\s*(?:static)?\s*[\w<>\[\]]+\s+(\w+)\s*\([^)]*\)\s*\{/g;
  const lines = code.split(/\r?\n/);
  lines.forEach((line, idx) => {
    const match = methodRegex.exec(line);
    if (match) {
      results.push({
        name: match[1],
        file: filePath,
        line: idx + 1,
        type: 'java-method',
      });
    }
    methodRegex.lastIndex = 0;
  });
  return results;
}

function parsePython(filePath: string, code: string): FunctionLocation[] {
  // Simple regex-based Python function detection
  const results: FunctionLocation[] = [];
  const funcRegex = /^\s*def\s+(\w+)\s*\(/gm;
  let match;
  while ((match = funcRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split(/\r?\n/).length;
    results.push({
      name: match[1],
      file: filePath,
      line: line,
      type: 'python-function',
    });
  }
  return results;
}

export function findAllFunctionsInFile(filePath: string): FunctionLocation[] {
  const fs = require('fs');
  const ext = path.extname(filePath).toLowerCase();
  const code = fs.readFileSync(filePath, 'utf-8');
  if (ext === '.js' || ext === '.ts') {
    return parseJSorTS(filePath, code);
  } else if (ext === '.java') {
    return parseJava(filePath, code);
  } else if (ext === '.py') {
    return parsePython(filePath, code);
  }
  // Add more language parsers here as needed
  return [];
}

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