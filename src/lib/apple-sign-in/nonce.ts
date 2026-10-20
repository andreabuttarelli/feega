const NONCE_BYTES = 32;

export type AppleNonce = { raw: string; hashed: string };

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function appleNonce(): Promise<AppleNonce> {
  const raw = hex(crypto.getRandomValues(new Uint8Array(NONCE_BYTES)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return { raw, hashed: hex(new Uint8Array(digest)) };
}
