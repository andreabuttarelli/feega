export const SID_LENGTH = 10;

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
const SID = /^[a-z2-7]{10}$/;
const BASE32_MASK = 31;

const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));

export function newSid(random: (length: number) => Uint8Array = randomBytes): string {
  return Array.from(random(SID_LENGTH), (byte) => ALPHABET[byte & BASE32_MASK]).join('');
}

export const isSid = (value: unknown): value is string => typeof value === 'string' && SID.test(value);

export function sidOfHost(host: string | null | undefined, baseDomain: string): string | null {
  const suffix = `.${baseDomain}`;
  const lower = host?.toLowerCase() ?? '';
  if (!lower.endsWith(suffix)) {
    return null;
  }
  const sid = lower.slice(0, -suffix.length);
  return isSid(sid) ? sid : null;
}
