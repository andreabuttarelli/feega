import { describe, it, expect } from 'vitest';
import { keepSame } from './snapshot-keep';

const NOW = Date.UTC(2026, 8, 29, 12);
const HOUR_S = 3600;

function token(expSeconds: number, iat: number): string {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'HS256' })}.${part({ url: 'canvas-assets/a.jpg', iat, exp: expSeconds })}.sig${iat}`;
}

function signed(expSeconds: number, iat: number): string {
  return `https://x.supabase.co/storage/v1/object/sign/canvas-assets/a.jpg?token=${token(expSeconds, iat)}`;
}

describe('keepSame: a refetch that changes nothing keeps what the screen already shows', () => {
  it('tornare sulla tela senza modifiche non ricrea i riquadri', () => {
    const shown = [{ id: 'a', version: 2, x: 0, y: 0, data: { prompt: 'p' } }];
    const fetched = [{ id: 'a', version: 2, x: 0, y: 0, data: { prompt: 'p' } }];

    expect(keepSame(shown, fetched, NOW)).toBe(shown);
  });

  it('una firma rinnovata sulla stessa miniatura non la fa riscaricare', () => {
    const exp = NOW / 1000 + 2 * HOUR_S;
    const shown = { feed: [{ id: 'p1', media: { thumbnailUrl: signed(exp, 1) } }] };
    const fetched = { feed: [{ id: 'p1', media: { thumbnailUrl: signed(exp + 60, 2) } }] };

    expect(keepSame(shown, fetched, NOW)).toBe(shown);
  });

  it('un nodo cambiato davvero passa', () => {
    const shown = [{ id: 'a', version: 2 }];
    const fetched = [{ id: 'a', version: 3 }];

    expect(keepSame(shown, fetched, NOW)).toBe(fetched);
  });

  it('una firma scaduta si rinnova anche se il resto è uguale', () => {
    const expired = NOW / 1000 - 1;
    const shown = { feed: [{ id: 'p1', thumb: signed(expired, 1) }] };
    const fetched = { feed: [{ id: 'p1', thumb: signed(NOW / 1000 + HOUR_S, 2) }] };

    expect(keepSame(shown, fetched, NOW)).toBe(fetched);
  });
});
