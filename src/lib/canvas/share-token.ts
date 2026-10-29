const TOKEN_BYTES = 24;
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{32}$/;

export function mintShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const mintedOr = (token: string | undefined): string => (token && TOKEN_SHAPE.test(token) ? token : mintShareToken());
