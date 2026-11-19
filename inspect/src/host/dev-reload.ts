import { createHash } from 'node:crypto';
import { readFileSync, watch } from 'node:fs';
import { join } from 'node:path';
import * as vscode from 'vscode';

const SETTLE_MS = 300;
const HOST_BUNDLE = 'extension.cjs';
const WEBVIEW_DIR = 'webview';

function debounced(run: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(run, SETTLE_MS);
  };
}

const hashOf = (path: string) => {
  try {
    return createHash('sha1').update(readFileSync(path)).digest('hex');
  } catch {
    return '';
  }
};

export function devReload(context: vscode.ExtensionContext, reloadView: () => void): void {
  if (context.extensionMode !== vscode.ExtensionMode.Development) {
    return;
  }
  const dist = join(context.extensionPath, 'dist');
  const bundle = join(dist, HOST_BUNDLE);
  let loaded = hashOf(bundle);
  const restartHost = debounced(() => {
    const now = hashOf(bundle);
    if (!now || now === loaded) {
      return;
    }
    loaded = now;
    vscode.commands.executeCommand('workbench.action.restartExtensionHost');
  });
  const view = debounced(reloadView);

  const watcher = watch(dist, { recursive: true }, (_event, name) => {
    if (name === HOST_BUNDLE) {
      restartHost();
      return;
    }
    if (name?.startsWith(WEBVIEW_DIR)) {
      view();
    }
  });
  context.subscriptions.push({ dispose: () => watcher.close() });
}
