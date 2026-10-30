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

export function startUrlOf(raw: string | null | undefined): string | null {
  if (!raw || raw.length > START_URL_MAX || !URL.canParse(raw)) {
    return null;
  }

  const url = new URL(raw);
  if (!WEB_SCHEMES.includes(url.protocol) || url.username || url.password) {
    return null;
  }
  if (internalHost(url.hostname.toLowerCase())) {
    return null;
  }
  return url.toString();
}

export function startHost(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '');
}
