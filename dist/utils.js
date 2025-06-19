"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAllFunctionsInFile = findAllFunctionsInFile;
exports.flattenDependencies = flattenDependencies;
const babelParser = __importStar(require("@babel/parser"));
const traverse_1 = __importDefault(require("@babel/traverse"));
const t = __importStar(require("@babel/types"));
const path = __importStar(require("path"));
function parseJSorTS(filePath, code) {
    const ast = babelParser.parse(code, {
        sourceType: 'unambiguous',
        plugins: ['typescript', 'classProperties'],
    });
    const results = [];
    (0, traverse_1.default)(ast, {
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
            if (path.node.init &&
                (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init)) &&
                path.node.id.type === 'Identifier' &&
                path.node.loc) {
                results.push({
                    name: path.node.id.name,
                    file: filePath,
                    line: path.node.loc.start.line,
                    type: 'arrow',
                });
            }
        },
        ClassMethod(path) {
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
function parseJava(filePath, code) {
    // Simple regex-based Java method detection
    const results = [];
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
function parsePython(filePath, code) {
    // Simple regex-based Python function detection
    const results = [];
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
function findAllFunctionsInFile(filePath) {
    const fs = require('fs');
    const ext = path.extname(filePath).toLowerCase();
    const code = fs.readFileSync(filePath, 'utf-8');
    if (ext === '.js' || ext === '.ts') {
        return parseJSorTS(filePath, code);
    }
    else if (ext === '.java') {
        return parseJava(filePath, code);
    }
    else if (ext === '.py') {
        return parsePython(filePath, code);
    }
    // Add more language parsers here as needed
    return [];
}
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
