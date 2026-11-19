import { describe, expect, it } from 'vitest';
import { portsServing, servesWorkspace } from './listener';

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

describe('portsServing', () => {
  const LISTEN = 'p101\nn127.0.0.1:5173\np101\nn[::1]:5173\np202\nn*:3000\np303\nn127.0.0.1:4000\n';
  const CWDS = 'p101\nfcwd\nn/w/app\np202\nfcwd\nn/other\np303\nfcwd\nn/w/app/web\n';

  it('trova le porte di un server avviato dalla cartella dell app, su qualunque porta', async () => {
    const found = await portsServing('/w/app', { listening: async () => LISTEN, cwds: async () => CWDS }, new Set());
    expect(found).toEqual([5173, 4000]);
  });

  it('salta i server avviati da Feega stesso', async () => {
    const found = await portsServing('/w/app', { listening: async () => LISTEN, cwds: async () => CWDS }, new Set([101]));
    expect(found).toEqual([4000]);
  });
});
