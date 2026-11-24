/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

type PushMessage = { title?: string; body?: string; url?: string };

const DEFAULT_TITLE = 'Feega';
const ICON = '/icon-192.png';

sw.addEventListener('install', () => {
  void sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(sw.clients.claim());
});

sw.addEventListener('push', (event) => {
  const message: PushMessage = event.data?.json() ?? {};

  event.waitUntil(
    sw.registration.showNotification(message.title ?? DEFAULT_TITLE, {
      body: message.body,
      icon: ICON,
      data: { url: message.url ?? '/' }
    })
  );
});

sw.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(sw.clients.openWindow(event.notification.data.url as string));
});
