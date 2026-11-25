import { MOUNT_STATUS, Status } from './mount-protocol.js';

export const MOUNT_ROUTE = '/__feega/mount';
export const MODULE_ROUTE = '/__feega/mount-module.js';
export const PROPS_ROUTE = '/__feega/props';
export const PROVIDERS_QUERY = 'feega-providers';
export const NESTED_HOST = "Symbol.for('feega.nested-host')";

export type MountRequest = { file: string; name: string; props: Record<string, unknown> };
export type MountPage = { runtimeUrl: string; componentUrl: string; providersUrl: string | null };

function propsOf(text: string | null): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const insideProject = (file: string) => !file.startsWith('/') && !file.split('/').includes('..');

export function mountRequestOf(url: URL): MountRequest | null {
  const file = url.searchParams.get('file');
  const name = url.searchParams.get('name') ?? '';
  if (!file || !insideProject(file)) {
    return null;
  }
  return { file, name, props: propsOf(url.searchParams.get('props')) };
}

export function mountHtml(query: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<script>window[${NESTED_HOST}] = true;</script>
<script>window.addEventListener('error', (event) => window.parent.postMessage({ type: '${MOUNT_STATUS}', status: '${Status.Failed}', reason: String(event.message || 'The component could not load') }, '*'), true);</script>
</head>
<body>
<div id="root"></div>
<script type="module" src="${MODULE_ROUTE}?${query}"></script>
</body>
</html>
`;
}

export function mountModule({ file, name, props }: MountRequest, { runtimeUrl, componentUrl, providersUrl }: MountPage): string {
  const controlsUrl = `${PROPS_ROUTE}?${new URLSearchParams({ file, name })}`;
  const providers = providersUrl ? `await import(${JSON.stringify(providersUrl)}).then((m) => m.Providers).catch(() => null)` : 'null';
  const start = JSON.stringify({ name, file, props, controlsUrl });

  return `import * as react from "react";
import { createRoot } from "react-dom/client";
import * as mod from ${JSON.stringify(componentUrl)};
import { startMount } from ${JSON.stringify(runtimeUrl)};
const providers = ${providers};
startMount({ react, createRoot, mod, providers, ...${start} });
`;
}
