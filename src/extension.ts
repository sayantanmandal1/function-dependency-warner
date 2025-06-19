import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { findAllFunctionsInFile, FunctionLocation } from './utils';

let dependencyGraph: Record<string, string[]> = {};

function getAllDependents(func: string): string[] {
  const visited = new Set<string>();
  const result = new Set<string>();
  
  function traverse(currentFunc: string) {
    if (visited.has(currentFunc)) return;
    visited.add(currentFunc);
    
    const directDeps = dependencyGraph[currentFunc] || [];
    directDeps.forEach(dep => {
      result.add(dep);
      traverse(dep);
    });
  }
  
  traverse(func);
  return Array.from(result);
}

// Use a WeakMap to cache file parsing results
const functionCache = new WeakMap<vscode.TextDocument, Promise<FunctionLocation[]>>();

async function findFunctionLocationsInWorkspace(funcNames: string[]): Promise<FunctionLocation[]> {
  try {
    const allLocations: FunctionLocation[] = [];
    const searchPatterns = [
      '**/*.{js,ts,jsx,tsx}',
      '**/*.java',
      '**/*.py',
      '**/src/**/*.{js,ts,jsx,tsx,java,py}',
      '**/lib/**/*.{js,ts,jsx,tsx,java,py}',
      '**/app/**/*.{js,ts,jsx,tsx,java,py}'
    ];
    
    for (const pattern of searchPatterns) {
      const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
      
      for (const uri of uris) {
        try {
          const document = await vscode.workspace.openTextDocument(uri);
          let foundPromise = functionCache.get(document);
          
          if (!foundPromise) {
            foundPromise = findAllFunctionsInFile(uri.fsPath);
            functionCache.set(document, foundPromise);
          }
          
          const found = await foundPromise;
          for (const loc of found) {
            if (funcNames.includes(loc.name)) {
              allLocations.push(loc);
            }
          }
        } catch (err) {
          console.error('[FDW] Error processing file:', uri.fsPath, err);
        }
      }
    }
    
    return allLocations;
  } catch (err) {
    console.error('[FDW] Error finding files:', err);
    return [];
  }
}

export function activate(context: vscode.ExtensionContext) {
  try {
    console.log('[FDW] Extension activating...');
    // Load dependency file synchronously during activation
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
      return;
    }

    const depPath = path.join(workspaceFolder, 'dependencies.json');
    if (fs.existsSync(depPath)) {
      try {
        const content = fs.readFileSync(depPath, 'utf8');
        dependencyGraph = JSON.parse(content);
        console.log('[FDW] Loaded dependency graph:', dependencyGraph);
      } catch (err) {
        console.error('[FDW] Error loading dependencies.json:', err);
      }
    }

    let changeTimeout: NodeJS.Timeout | undefined;

    // Register the document change listener
    const disposable = vscode.workspace.onDidChangeTextDocument(async event => {
      try {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== event.document) return;

        // Clear existing timeout
        if (changeTimeout) {
          clearTimeout(changeTimeout);
        }

        // Set new timeout for 300ms debouncing
        changeTimeout = setTimeout(async () => {
          const fullText = editor.document.getText();
          for (const func of Object.keys(dependencyGraph)) {
            // More comprehensive function detection patterns
            const patterns = [
              `def ${func}\\s*\\(`, // Python
              `function\\s+${func}\\s*\\(`, // JavaScript/TypeScript
              `${func}\\s*=\\s*(?:async\\s*)?(?:function\\s*)?\\(`, // JS/TS arrow/assignment
              `(?:public|private|protected)\\s+(?:static\\s+)?(?:[\\w<>\\[\\]]+\\s+)?${func}\\s*\\(`, // Java
              `@\\w+\\s*[\\r\\n\\s]*(?:public|private|protected)\\s+(?:static\\s+)?(?:[\\w<>\\[\\]]+\\s+)?${func}\\s*\\(` // Java with annotations
            ];
            
            if (patterns.some(pattern => new RegExp(pattern).test(fullText))) {
              const deps = getAllDependents(func);
              if (deps.length > 0) {
                // Include the function being changed in the location search
                const locations = await findFunctionLocationsInWorkspace([func, ...deps]);
                
                // Group dependencies by their immediate parent
                const depTree: Record<string, string[]> = {};
                deps.forEach(dep => {
                  const parent = Object.entries(dependencyGraph)
                    .find(([_, deps]) => deps.includes(dep))?.[0];
                  if (parent) {
                    depTree[parent] = depTree[parent] || [];
                    depTree[parent].push(dep);
                  }
                });

                // Format the message to show the dependency tree
                const message = `⚠️ Warning: Changing '${func}' may affect:\n${
                  deps.map(dep => {
                    const locs = locations.filter(l => l.name === dep);
                    const locInfo = locs.length > 0
                      ? locs.map(l => `${dep} (${path.basename(l.file)}:${l.line})`).join(', ')
                      : `${dep} (searching...)`;
                    return locInfo;
                  }).join('\n')
                }`;

                vscode.window.showWarningMessage(message);
                
                // If any locations weren't found, trigger an additional search
                const missingDeps = deps.filter(dep => 
                  !locations.some(loc => loc.name === dep)
                );
                
                if (missingDeps.length > 0) {
                  findFunctionLocationsInWorkspace(missingDeps).then(additionalLocs => {
                    if (additionalLocs.length > 0) {
                      const updateMessage = `Additional locations found:\n${
                        additionalLocs.map(loc => 
                          `${loc.name} (${path.basename(loc.file)}:${loc.line})`
                        ).join('\n')
                      }`;
                      vscode.window.showInformationMessage(updateMessage);
                    }
                  });
                }
              }
              break;
            }
          }
        }, 300);
      } catch (err) {
        console.error('[FDW] Error in change handler:', err);
      }
    });

    context.subscriptions.push(disposable);
    console.log('[FDW] Extension activated successfully');
  } catch (err) {
    console.error('[FDW] Error during activation:', err);
  }
}

export function deactivate() {}
