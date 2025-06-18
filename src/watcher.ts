import * as fs from 'fs';
import * as vscode from 'vscode';
import { loadDependencyGraph } from './dependencyGraph';

export function watchDependencyFile(filePath: string) {
  fs.watchFile(filePath, () => {
    loadDependencyGraph(filePath);
    vscode.window.showInformationMessage('Dependency file reloaded due to changes.');
  });
}
