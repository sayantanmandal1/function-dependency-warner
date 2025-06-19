import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { findAllFunctionsInFile, FunctionLocation } from './utils';

let dependencyGraph: Record<string, string[]> = {};

// Recursively collect all dependents
function getAllDependents(func: string, visited = new Set<string>()): string[] {
  if (visited.has(func)) return [];
  visited.add(func);

  const direct = dependencyGraph[func] || [];
  const indirect = direct.flatMap(dep => getAllDependents(dep, visited));
  return [...new Set([...direct, ...indirect])];
}

function findFunctionLocationsInWorkspace(funcNames: string[]): Promise<FunctionLocation[]> {
  return new Promise((resolve) => {
    vscode.workspace.findFiles('**/*.{js,ts,java,py}', '**/node_modules/**').then((uris: any[]) => {
      const allLocations: FunctionLocation[] = [];
      for (const uri of uris) {
        const filePath = uri.fsPath;
        const found = findAllFunctionsInFile(filePath);
        for (const loc of found) {
          if (funcNames.includes(loc.name)) {
            allLocations.push(loc);
          }
        }
      }
      resolve(allLocations);
    });
  });
}

export function activate(context: vscode.ExtensionContext) {
  const configPath = vscode.workspace.getConfiguration('funcWarn').get<string>('dependencyFile');
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
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to load dependency file: ${err}`);
    return;
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async event => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document !== event.document) return;
      const fullText = editor.document.getText();
      for (const func of Object.keys(dependencyGraph)) {
        if (
          fullText.includes(`def ${func}(`) ||
          fullText.includes(`function ${func}(`) ||
          fullText.includes(`${func}(`)
        ) {
          const deps = getAllDependents(func);
          if (deps.length > 0) {
            const locations = await findFunctionLocationsInWorkspace([func, ...deps]);
            console.log('DEBUG LOCATIONS', locations);
            const details = locations.length > 0
              ? locations.map(l => `${l.name} (${path.basename(l.file)}:${l.line})`).join(', ')
              : 'No locations found.';
            vscode.window.showWarningMessage(
              `⚠️ Warning: Changing '${func}' may affect: ${deps.map(dep => {
                const locs = locations.filter(l => l.name === dep);
                if (locs.length > 0) {
                  return locs.map(l => `${dep} (${path.basename(l.file)}:${l.line})`).join(', ');
                } else {
                  return dep + ' (location not found)';
                }
              }).join(', ')} `
            );
          }
          break;
        }
      }
    })
  );

  vscode.window.showInformationMessage("Function Dependency Warner activated.");
}

export function deactivate() {}
