import { describe, expect, it } from 'vitest';
import { servesWorkspace } from './listener';

describe('servesWorkspace', () => {
  it('attacca solo a un server avviato dalla cartella del workspace', async () => {
    expect(await servesWorkspace(3000, '/w/app', async () => '/w/app')).toBe(true);
    expect(await servesWorkspace(3000, '/w/app', async () => '/w/app/sub')).toBe(true);
  });

  it('non attacca a un server di un altra app sulla stessa porta', async () => {
    expect(await servesWorkspace(3000, '/w/app', async () => '/other/app')).toBe(false);
    expect(await servesWorkspace(3000, '/w/app', async () => '/w/app-two')).toBe(false);
    expect(await servesWorkspace(3000, '/w/app', async () => null)).toBe(false);
  });
});
