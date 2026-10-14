/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, version } from '$service-worker';
import { cacheable } from '$lib/pwa/shell-cache';

const sw = self as unknown as ServiceWorkerGlobalScope;

const SHELL_CACHE = `shell-${version}`;
const SHELL_ICONS = ['/site.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/fonts/dm-sans-latin.woff2'];
const SHELL = new Set([...build, ...SHELL_ICONS]);

sw.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ICONS)));
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))))
  );
});

sw.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!cacheable(event.request.method, url, sw.location.origin, SHELL)) {
    return;
  }
  event.respondWith(fromShell(event.request));
});

async function fromShell(request: Request): Promise<Response> {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(request);
  if (hit) {
    return hit;
  }
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

function toAbsoluteUrl(url: string): string {
	try {
		return new URL(url, sw.location.origin).href;
	} catch {
		return sw.location.origin + '/';
	}
}

sw.addEventListener('push', (event) => {
	event.waitUntil(
		(async () => {
			let data: {
				title?: string;
				body?: string;
				url?: string;
				tag?: string;
				icon?: string;
				skipIfFocused?: boolean;
			} = {};
			try {
				data = event.data?.json() ?? {};
			} catch {
				data = { body: event.data?.text() };
			}

			// Chat-style alerts: don't interrupt if the user is already looking at feega.
			if (data.skipIfFocused) {
				const clients = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
				if (clients.some((c) => (c as WindowClient).focused)) return;
			}

			const title = data.title || 'feega';
			const targetUrl = toAbsoluteUrl(data.url || '/');
			const options: NotificationOptions = {
				body: data.body || '',
				icon: data.icon || '/icon-192.png',
				badge: '/icon-192.png',
				tag: data.tag || 'feega',
				data: { url: targetUrl },
				renotify: true
			};

			await sw.registration.showNotification(title, options);
		})()
	);
});

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = toAbsoluteUrl((event.notification.data && event.notification.data.url) || '/');
	event.waitUntil(
		(async () => {
			const all = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
			for (const client of all) {
				const c = client as WindowClient;
				if ('focus' in c) {
					await c.focus();
					if ('navigate' in c) {
						try {
							await c.navigate(url);
						} catch {
							/* older browsers */
						}
					}
					return;
				}
			}
			await sw.clients.openWindow(url);
		})()
	);
});
