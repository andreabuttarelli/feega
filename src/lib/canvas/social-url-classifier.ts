export const CLASSIFIABLE_PLATFORMS = ['instagram', 'tiktok', 'x', 'threads', 'facebook', 'youtube', 'linkedin'] as const;
export type ClassifiablePlatform = (typeof CLASSIFIABLE_PLATFORMS)[number];

export const UNSUPPORTED_HOSTS: Record<string, string> = {
  'reddit.com': 'reddit',
  'pinterest.com': 'pinterest'
};

export type SocialEntryKind = 'profile' | 'post' | 'hashtag';

export type SocialEntry = {
  platform: ClassifiablePlatform;
  kind: SocialEntryKind;
  handle: string | null;
  id: string | null;
  source: string;
};

export type ClassifyFailureReason = 'not_supported' | 'unrecognized';

export type ClassifyResult =
  | { ok: true; entry: SocialEntry }
  | { ok: false; reason: ClassifyFailureReason; message: string };

type Segment = { path: string[]; qs: URLSearchParams; host: string };

type Matcher = (seg: Segment) => Omit<SocialEntry, 'platform' | 'source'> | null;

const strip = (s: string) => decodeURIComponent(s).replace(/^@/, '');
const lower = (s: string) => s.toLowerCase();
const clean = (segments: string[]) => segments.filter(Boolean);

function toSegment(url: URL): Segment {
  return { path: clean(url.pathname.split('/')), qs: url.searchParams, host: lower(url.hostname).replace(/^www\.|^m\./, '') };
}

const instagramMatchers: Matcher[] = [
  (s) => (s.path[0] === 'p' && s.path[1] ? { kind: 'post', handle: null, id: s.path[1] } : null),
  (s) => (s.path[0] === 'reel' && s.path[1] ? { kind: 'post', handle: null, id: s.path[1] } : null),
  (s) => (s.path[0] === 'tv' && s.path[1] ? { kind: 'post', handle: null, id: s.path[1] } : null),
  (s) => (s.path[0] === 'explore' && s.path[1] === 'tags' && s.path[2] ? { kind: 'hashtag', handle: null, id: strip(s.path[2]) } : null),
  (s) => (s.path[0] && !['p', 'reel', 'tv', 'explore'].includes(s.path[0]) ? { kind: 'profile', handle: strip(s.path[0]), id: null } : null)
];

const tiktokMatchers: Matcher[] = [
  (s) => {
    const videoIdx = s.path.indexOf('video');
    return videoIdx > 0 && s.path[videoIdx + 1]
      ? { kind: 'post', handle: strip(s.path[0]), id: s.path[videoIdx + 1] }
      : null;
  },
  (s) => (s.path[0] === 'tag' && s.path[1] ? { kind: 'hashtag', handle: null, id: strip(s.path[1]) } : null),
  (s) => (s.path[0] ? { kind: 'profile', handle: strip(s.path[0]), id: null } : null)
];

const xMatchers: Matcher[] = [
  (s) => {
    const statusIdx = s.path.indexOf('status');
    return statusIdx > 0 && s.path[statusIdx + 1]
      ? { kind: 'post', handle: strip(s.path[0]), id: s.path[statusIdx + 1] }
      : null;
  },
  (s) => (s.path[0] ? { kind: 'profile', handle: strip(s.path[0]), id: null } : null)
];

const threadsMatchers: Matcher[] = [
  (s) => {
    const postIdx = s.path.indexOf('post');
    return postIdx > 0 && s.path[postIdx + 1]
      ? { kind: 'post', handle: strip(s.path[0]), id: s.path[postIdx + 1] }
      : null;
  },
  (s) => (s.path[0] ? { kind: 'profile', handle: strip(s.path[0]), id: null } : null)
];

const facebookMatchers: Matcher[] = [
  (s) => (s.path[0] === 'reel' && s.path[1] ? { kind: 'post', handle: null, id: s.path[1] } : null),
  (s) => (s.path[0] === 'watch' && s.qs.get('v') ? { kind: 'post', handle: null, id: s.qs.get('v')! } : null),
  (s) => {
    const postsIdx = s.path.indexOf('posts');
    return postsIdx > 0 && s.path[postsIdx + 1]
      ? { kind: 'post', handle: strip(s.path[0]), id: s.path[postsIdx + 1] }
      : null;
  },
  (s) => (s.path[0] ? { kind: 'profile', handle: strip(s.path[0]), id: null } : null)
];

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{6,}$/;

const youtubeMatchers: Matcher[] = [
  (s) => (s.host === 'youtu.be' && s.path[0] ? { kind: 'post', handle: null, id: s.path[0] } : null),
  (s) => (s.path[0] === 'watch' && s.qs.get('v') ? { kind: 'post', handle: null, id: s.qs.get('v')! } : null),
  (s) => (s.path[0] === 'shorts' && s.path[1] ? { kind: 'post', handle: null, id: s.path[1] } : null),
  (s) => (s.path[0] === 'channel' && s.path[1] ? { kind: 'profile', handle: null, id: s.path[1] } : null),
  (s) => (s.path[0] === 'c' && s.path[1] ? { kind: 'profile', handle: strip(s.path[1]), id: null } : null),
  (s) => (s.path[0] === 'user' && s.path[1] ? { kind: 'profile', handle: strip(s.path[1]), id: null } : null),
  (s) => (s.path[0]?.startsWith('@') ? { kind: 'profile', handle: strip(s.path[0]), id: null } : null)
];

const linkedinMatchers: Matcher[] = [
  (s) => (s.path[0] === 'company' && s.path[1] ? { kind: 'profile', handle: strip(s.path[1]), id: null } : null),
  (s) => (s.path[0] === 'in' && s.path[1] ? { kind: 'profile', handle: strip(s.path[1]), id: null } : null)
];

const PLATFORM_HOSTS: Record<string, ClassifiablePlatform> = {
  'instagram.com': 'instagram',
  'tiktok.com': 'tiktok',
  'x.com': 'x',
  'twitter.com': 'x',
  'threads.com': 'threads',
  'threads.net': 'threads',
  'facebook.com': 'facebook',
  'fb.com': 'facebook',
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'linkedin.com': 'linkedin'
};

const PLATFORM_MATCHERS: Record<ClassifiablePlatform, Matcher[]> = {
  instagram: instagramMatchers,
  tiktok: tiktokMatchers,
  x: xMatchers,
  threads: threadsMatchers,
  facebook: facebookMatchers,
  youtube: youtubeMatchers,
  linkedin: linkedinMatchers
};

const HASHTAG_RE = /^#([A-Za-z0-9_]+)$/;

function asUrl(raw: string): URL | null {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

function unsupportedHostOf(host: string): string | null {
  for (const domain of Object.keys(UNSUPPORTED_HOSTS)) {
    if (host === domain || host.endsWith(`.${domain}`)) {
      return UNSUPPORTED_HOSTS[domain];
    }
  }
  return null;
}

/**
 * Classifica un singolo input dell'utente (handle nudo, URL di profilo, URL di un post,
 * hashtag) in una entry tipizzata: {platform, kind, handle, id}. Una tabella di matcher per
 * piattaforma, non un albero di `if`: ogni piattaforma aggiunge una riga, non un nuovo ramo.
 */
export function classifySocialInput(raw: string): ClassifyResult {
  const value = raw.trim();
  if (!value) {
    return { ok: false, reason: 'unrecognized', message: 'empty input' };
  }

  const hashtagMatch = HASHTAG_RE.exec(value);
  if (hashtagMatch) {
    return { ok: true, entry: { platform: 'instagram', kind: 'hashtag', handle: null, id: lower(hashtagMatch[1]), source: raw } };
  }

  if (!value.includes('.') && !value.includes('/')) {
    return { ok: true, entry: { platform: 'instagram', kind: 'profile', handle: strip(value), id: null, source: raw } };
  }

  const url = asUrl(value);
  if (!url) {
    return { ok: false, reason: 'unrecognized', message: `could not parse "${raw}" as a URL` };
  }

  const seg = toSegment(url);
  const unsupported = unsupportedHostOf(seg.host);
  if (unsupported) {
    return { ok: false, reason: 'not_supported', message: `${unsupported} is not supported yet` };
  }

  const platform = PLATFORM_HOSTS[seg.host];
  if (!platform) {
    return { ok: false, reason: 'unrecognized', message: `unknown host "${seg.host}"` };
  }

  for (const matcher of PLATFORM_MATCHERS[platform]) {
    const matched = matcher(seg);
    if (matched) {
      return { ok: true, entry: { platform, source: raw, ...matched } };
    }
  }

  return { ok: false, reason: 'unrecognized', message: `could not classify "${raw}" for ${platform}` };
}

export type ClassifyLinesResult = {
  entries: SocialEntry[];
  errors: { source: string; reason: ClassifyFailureReason; message: string }[];
};

/** Divide per newline o virgola, classifica ogni entry, separa successi ed errori. */
export function classifySocialLines(raw: string): ClassifyLinesResult {
  const lines = raw
    .split(/[\n,]/)
    .map((l) => l.trim())
    .filter(Boolean);

  const entries: SocialEntry[] = [];
  const errors: ClassifyLinesResult['errors'] = [];

  for (const line of lines) {
    const result = classifySocialInput(line);
    if (result.ok) {
      entries.push(result.entry);
    } else {
      errors.push({ source: line, reason: result.reason, message: result.message });
    }
  }

  return { entries, errors };
}
