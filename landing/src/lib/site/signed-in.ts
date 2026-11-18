import { APP_URL } from './links';

const SEEN_KEY = 'feega_entered_app';

export type Visit = { path: string; search: string; signedIn: boolean; seen: boolean; userAgent: string };

export function goesToApp(visit: Visit): boolean {
  const robot = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|lighthouse|headless/i;

  if (visit.path !== '/' || visit.seen || !visit.signedIn) {
    return false;
  }

  if (new URLSearchParams(visit.search).has('stay')) {
    return false;
  }

  return !robot.test(visit.userAgent);
}

export function hasSignedInHint(cookie: string): boolean {
  return cookie.split(';').some((pair) => pair.trim() === 'feega_signed_in=1');
}

export function homeHref(cookie: string): string {
  return hasSignedInHint(cookie) ? APP_URL : '/';
}

function enterAppOnce(go: typeof goesToApp, hinted: typeof hasSignedInHint, appUrl: string, seenKey: string) {
  let seen: boolean;
  try {
    seen = localStorage.getItem(seenKey) !== null;
  } catch {
    return;
  }

  const visit = { path: location.pathname, search: location.search, signedIn: hinted(document.cookie), seen, userAgent: navigator.userAgent };
  if (!go(visit)) {
    return;
  }

  try {
    localStorage.setItem(seenKey, '1');
  } catch {
    return;
  }

  location.replace(appUrl);
}

export const FIRST_VISIT_SCRIPT = `(${enterAppOnce})(${goesToApp}, ${hasSignedInHint}, ${JSON.stringify(APP_URL)}, ${JSON.stringify(SEEN_KEY)})`;

export const FIRST_VISIT_TAG = `<script>${FIRST_VISIT_SCRIPT}</script>`;
