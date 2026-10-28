import '$lib/i18n';
import { waitLocale } from 'svelte-i18n';
import type { LayoutLoad } from './$types';
import { browser, dev } from '$app/environment';
import { injectAnalytics } from '@vercel/analytics/sveltekit';
import { viewerCall, viewerSession } from '$lib/api/client';
import { bundleApiBase } from '$lib/api/bundle-fetch';
import { keepAssetGrant } from '$lib/api/asset-grant';
import type { RootShell } from '$lib/server/root-shell';

if (import.meta.env.VITE_VERCEL_ANALYTICS && (!browser || !bundleApiBase())) {
  injectAnalytics({ mode: dev ? 'development' : 'production' });
}

const ROOT_API = '/api/v1/me/root';

function grantFor(signedIn: boolean): void {
  const apiBase = bundleApiBase();
  if (apiBase && signedIn) {
    keepAssetGrant(apiBase).catch((e) => console.error('asset grant', e));
  }
}

async function inBrowser(): Promise<RootShell> {
  const [session, shell] = await Promise.all([viewerSession(), viewerCall<RootShell>(`${ROOT_API}?host=${encodeURIComponent(location.hostname)}`)]);
  grantFor(!!session);
  return { ...shell, session };
}

async function onServer(fetch: typeof globalThis.fetch): Promise<RootShell> {
  return (await (await fetch(ROOT_API)).json()) as RootShell;
}

export const load: LayoutLoad = async ({ fetch }) => {
  await waitLocale();
  return browser ? inBrowser() : onServer(fetch);
};
