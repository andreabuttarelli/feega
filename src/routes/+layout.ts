import '$lib/i18n';
import { waitLocale } from 'svelte-i18n';
import type { LayoutLoad } from './$types';
import { browser, dev } from '$app/environment';
import { injectAnalytics } from '@vercel/analytics/sveltekit';
import { viewerCall, viewerSession } from '$lib/api/client';
import type { RootShell } from '$lib/server/root-shell';

injectAnalytics({ mode: dev ? 'development' : 'production' });

const ROOT_API = '/api/v1/me/root';

async function inBrowser(): Promise<RootShell> {
  const [session, shell] = await Promise.all([viewerSession(), viewerCall<RootShell>(`${ROOT_API}?host=${encodeURIComponent(location.hostname)}`)]);
  return { ...shell, session };
}

async function onServer(fetch: typeof globalThis.fetch): Promise<RootShell> {
  return (await (await fetch(ROOT_API)).json()) as RootShell;
}

export const load: LayoutLoad = async ({ fetch }) => {
  await waitLocale();
  return browser ? inBrowser() : onServer(fetch);
};
