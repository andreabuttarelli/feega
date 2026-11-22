import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { GET } from './+server';
import { DESKTOP_DMGS, DESKTOP_INSTALL_COMMAND, DESKTOP_RELEASE_URL } from '$lib/site/links';

describe('GET /install', () => {
  it('serves a shell script as text', async () => {
    const response = GET();
    const body = await response.text();

    expect(response.headers.get('content-type')).toContain('text/x-shellscript');
    expect(body.startsWith('#!/bin/sh\nset -eu\n')).toBe(true);
  });

  it('downloads from the desktop-latest release', async () => {
    const body = await GET().text();

    expect(body).toContain(DESKTOP_RELEASE_URL);
    expect(body).toContain('$APP_NAME-mac-$arch.zip');
    expect(body).toContain('$APP_NAME-linux-x64.AppImage');
  });

  it('is the script the published command pipes to sh', () => {
    expect(DESKTOP_INSTALL_COMMAND).toBe('curl -fsSL https://www.feega.app/install | sh');
    expect(DESKTOP_DMGS.map((d) => d.href.split('/').pop())).toEqual(['Feega-mac-arm64.dmg', 'Feega-mac-x64.dmg']);
  });

  it('parses as POSIX sh', async () => {
    const result = spawnSync('sh', ['-n'], { input: await GET().text() });

    expect(result.status).toBe(0);
  });
});
