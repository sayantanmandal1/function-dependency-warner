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
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
let dependencyGraph = {};
// Recursively collect all dependents
function getAllDependents(func, visited = new Set()) {
    if (visited.has(func))
        return [];
    visited.add(func);
    const direct = dependencyGraph[func] || [];
    const indirect = direct.flatMap(dep => getAllDependents(dep, visited));
    return [...new Set([...direct, ...indirect])];
}
function activate(context) {
    const configPath = vscode.workspace.getConfiguration('funcWarn').get('dependencyFile');
    if (!configPath) {
        vscode.window.showErrorMessage("Dependency file path not set in config.");
        return;
    }
    // Resolve the path correctly
    const fullPath = path.isAbsolute(configPath)
        ? configPath
        : path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', configPath);
    if (!fs.existsSync(fullPath)) {
        vscode.window.showErrorMessage(`Dependency file not found: ${fullPath}`);
        return;
    }
    try {
        const raw = fs.readFileSync(fullPath, 'utf8');
        dependencyGraph = JSON.parse(raw);
        console.log("Dependency graph loaded:", dependencyGraph);
    }
    catch (err) {
        vscode.window.showErrorMessage(`Failed to load dependency file: ${err}`);
        return;
    }
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== event.document)
            return;
        const fullText = editor.document.getText();
        for (const func of Object.keys(dependencyGraph)) {
            if (fullText.includes(`def ${func}(`) ||
                fullText.includes(`function ${func}(`) ||
                fullText.includes(`${func}(`)) {
                const deps = getAllDependents(func);
                if (deps.length > 0) {
                    vscode.window.showWarningMessage(`⚠️ Warning: Changing '${func}' may affect: ${deps.join(', ')}`);
                }
                break;
            }
        }
    }));
    vscode.window.showInformationMessage("Function Dependency Warner activated.");
}
function deactivate() { }
