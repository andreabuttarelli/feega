const SITE = 'https://www.feega.app';
const APP = 'https://oh.feega.app';

const HOSTS_TO_PUBLIC_SITE: ReadonlySet<string> = new Set(['dalnulla.com', 'www.dalnulla.com', 'r.feega.app']);

const OLD_LOCALES = ['it', 'es', 'pt', 'de', 'fr'] as const;
type OldLocale = (typeof OLD_LOCALES)[number];

const LOCALIZED_HUB: Partial<Record<OldLocale, string>> = {
  it: `${SITE}/it/video-ai`,
  es: `${SITE}/es/video-ia`
};

const STYLES_HUB = `${SITE}/ai-video-styles`;
const HOME = `${SITE}/`;

const TARGET_BY_OLD_PATH: Readonly<Record<string, string>> = {
  '/': HOME,
  '/tools/ai-video-upscaler': `${SITE}/ai-video-upscaler`,
  '/docs/upscaler-nodes': `${SITE}/ai-video-upscaler`,
  '/tools/3d-animation-maker': `${SITE}/3d-animation-maker`,
  '/tools/ai-commercial-maker': `${SITE}/ai-commercial-maker`,
  '/tools/paper-cutout-animation': `${SITE}/paper-cutout-animation`,
  '/tools/80s-retro-video-maker': `${SITE}/80s-retro-video`,
  '/tools/anime-video-generator': `${SITE}/anime-video-generator`,
  '/tools/claymation-ai-generator': `${SITE}/claymation-ai`,
  '/sign-in': `${APP}/login`,
  '/pricing': HOME,
  '/privacy': `${SITE}/privacy`,
  '/terms': `${SITE}/terms`,
  '/cookie-policy': `${SITE}/cookies`
};

const TARGET_BY_OLD_PREFIX: readonly (readonly [string, string])[] = [
  ['/tools/', STYLES_HUB],
  ['/app', `${APP}/`]
];

function splitLocale(path: string): { locale: OldLocale | null; rest: string } {
  const [, first, ...tail] = path.split('/');
  const locale = OLD_LOCALES.find((l) => l === first);
  if (!locale) {
    return { locale: null, rest: path };
  }

  return { locale, rest: `/${tail.join('/')}` };
}

function normalize(pathname: string): string {
  const lower = pathname.toLowerCase();
  if (lower.length > 1 && lower.endsWith('/')) {
    return lower.slice(0, -1);
  }

  return lower;
}

function targetFor(pathname: string): string {
  const { locale, rest } = splitLocale(normalize(pathname));
  const hub = locale ? LOCALIZED_HUB[locale] : undefined;
  const exact = TARGET_BY_OLD_PATH[rest];

  if (exact?.startsWith(APP)) {
    return exact;
  }

  if (hub) {
    return hub;
  }

  if (exact) {
    return exact;
  }

  const prefixed = TARGET_BY_OLD_PREFIX.find(([prefix]) => rest.startsWith(prefix));
  return prefixed ? prefixed[1] : HOME;
}

export function redirectFor(url: URL): string | null {
  if (!HOSTS_TO_PUBLIC_SITE.has(url.hostname.toLowerCase())) {
    return null;
  }

  return `${targetFor(url.pathname)}${url.search}`;
}
