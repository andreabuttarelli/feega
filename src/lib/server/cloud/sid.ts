const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
const SID_LENGTH = 10;
const SID_PATTERN = /^[a-z2-7]{10}$/;

export function newSid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SID_LENGTH));

  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

export function isSid(value: string): boolean {
  return SID_PATTERN.test(value);
}
