export const START_URL_PARAM = 'start_url';
export const START_URL_MAX = 2000;

const WEB_SCHEMES = ['http:', 'https:'];
const INTERNAL_HOST = /(^localhost$|\.localhost$|\.local$|\.internal$)/;
const IPV4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
const IPV6 = /^\[.*\]$/;

function privateIpv4(host: string): boolean {
  const octets = host.match(IPV4);
  if (!octets) {
    return false;
  }
  const [a, b] = [Number(octets[1]), Number(octets[2])];
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 100 && b >= 64 && b <= 127);
}

function internalHost(host: string): boolean {
  return INTERNAL_HOST.test(host) || IPV6.test(host) || privateIpv4(host) || !host.includes('.');
}

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d+(\/|$))/i;
const DEFAULT_SCHEME = 'https://';

function withScheme(raw: string): string {
  const trimmed = raw.trim();
  return HAS_SCHEME.test(trimmed) ? trimmed : `${DEFAULT_SCHEME}${trimmed}`;
}

type Checked = { url: string } | { reason: string };

function check(raw: string): Checked {
  if (raw.length > START_URL_MAX) {
    return { reason: 'too long' };
  }

  const full = withScheme(raw);
  if (!URL.canParse(full)) {
    return { reason: 'not a url' };
  }

  const url = new URL(full);
  if (!WEB_SCHEMES.includes(url.protocol)) {
    return { reason: 'scheme' };
  }
  if (url.username || url.password) {
    return { reason: 'credentials' };
  }
  if (internalHost(url.hostname.toLowerCase())) {
    return { reason: 'internal host' };
  }
  return { url: url.toString() };
}

export function startUrlOf(raw: string | null | undefined): string | null {
  const checked = raw ? check(raw) : null;
  return checked && 'url' in checked ? checked.url : null;
}

export function startUrlRefusal(raw: string): string | null {
  const checked = check(raw);
  return 'reason' in checked ? checked.reason : null;
}

export function startHost(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '');
}
