import * as path from 'path';
import * as fs from 'fs';

// Lazy load babel modules
let babelParser: typeof import('@babel/parser');
let babelTraverse: typeof import('@babel/traverse').default;
let babelTypes: typeof import('@babel/types');

async function loadBabel() {
  if (!babelParser) {
    babelParser = await import('@babel/parser');
    babelTraverse = (await import('@babel/traverse')).default;
    babelTypes = await import('@babel/types');
  }
}

export interface FunctionLocation {
  name: string;
  file: string;
  line: number;
  type: string;
}

// Cache parsed ASTs to avoid reprocessing
const astCache = new Map<string, any>();

async function parseJSorTS(filePath: string, code: string): Promise<FunctionLocation[]> {
  try {
    await loadBabel();
    
    let ast = astCache.get(filePath);
    if (!ast) {
      ast = babelParser.parse(code, {
        sourceType: 'unambiguous',
        plugins: ['typescript', 'classProperties'],
      });
      astCache.set(filePath, ast);
    }

    const results: FunctionLocation[] = [];

    babelTraverse(ast, {
      FunctionDeclaration(path) {
        if (path.node.id && path.node.loc) {
          results.push({
            name: path.node.id.name,
            file: filePath,
            line: path.node.loc.start.line,
            type: 'declaration',
          });
        }
      },
      VariableDeclarator(path) {
        if (
          path.node.init &&
          (babelTypes.isArrowFunctionExpression(path.node.init) || babelTypes.isFunctionExpression(path.node.init)) &&
          babelTypes.isIdentifier(path.node.id) &&
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
      ClassMethod(path) {
        if (babelTypes.isIdentifier(path.node.key) && path.node.loc) {
          results.push({
            name: path.node.key.name,
            file: filePath,
            line: path.node.loc.start.line,
            type: 'method',
          });
        }
      },
    });
    return results;
  } catch (err) {
    console.error('[FDW] Error parsing JS/TS file:', filePath, err);
    return [];
  }
}

function parseJava(filePath: string, code: string): FunctionLocation[] {
  try {
    const results: FunctionLocation[] = [];
    const lines = code.split('\n');
    const methodRegex = /(?:public|private|protected|static|\s) +[\w\<\>\[\]]+\s+(\w+) *\([^\)]*\) *\{?/g;
    
    lines.forEach((line, index) => {
      const matches = [...line.matchAll(methodRegex)];
      matches.forEach(match => {
        if (match[1]) {
          results.push({
            name: match[1],
            file: filePath,
            line: index + 1,
            type: 'method'
          });
        }
      });
    });
    
    return results;
  } catch (err) {
    console.error('[FDW] Error parsing Java file:', filePath, err);
    return [];
  }
}

function parsePython(filePath: string, code: string): FunctionLocation[] {
  try {
    const results: FunctionLocation[] = [];
    const lines = code.split('\n');
    const functionRegex = /^\s*def\s+([a-zA-Z_]\w*)\s*\(/;
    
    lines.forEach((line, index) => {
      const match = line.match(functionRegex);
      if (match) {
        results.push({
          name: match[1],
          file: filePath,
          line: index + 1,
          type: 'function'
        });
      }
    });
    
    return results;
  } catch (err) {
    console.error('[FDW] Error parsing Python file:', filePath, err);
    return [];
  }
}

// Cache file contents to avoid repeated disk reads
const fileContentCache = new Map<string, string>();

export async function findAllFunctionsInFile(filePath: string): Promise<FunctionLocation[]> {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    let code = fileContentCache.get(filePath);
    if (!code) {
      code = fs.readFileSync(filePath, 'utf8');
      fileContentCache.set(filePath, code);
    }

    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.js':
      case '.ts':
      case '.jsx':
      case '.tsx':
        return parseJSorTS(filePath, code);
      case '.java':
        return parseJava(filePath, code);
      case '.py':
        return parsePython(filePath, code);
      default:
        return [];
    }
  } catch (err) {
    console.error('[FDW] Error processing file:', filePath, err);
    return [];
  }
}