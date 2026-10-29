import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { EVENT, NOTICE, buildEvent, installId, isOptedOut, sendTelemetry } from './telemetry.mjs';

const info = { version: '1.2.3', platform: 'darwin', arch: 'arm64', node: '22.1.0' };
const home = () => mkdtempSync(join(tmpdir(), 'feega-tel-'));
const run = (extra) => sendTelemetry({ home: home(), info, env: {}, today: '2026-10-29', ...extra });

describe('installId', () => {
  it('crea un uuid casuale e lo riusa', () => {
    const dir = home();
    const first = installId(dir);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(installId(dir)).toBe(first);
    expect(readFileSync(join(dir, '.feega', 'telemetry-id'), 'utf8').trim()).toBe(first);
  });
});

describe('buildEvent', () => {
  it('porta solo versione, sistema e id anonimo', () => {
    const body = buildEvent(EVENT.started, 'abc', info);
    expect(body.event).toBe('npx_feega_started');
    expect(body.distinct_id).toBe('abc');
    expect(Object.keys(body.properties).sort()).toEqual(
      ['$geoip_disable', '$ip', '$process_person_profile', 'arch', 'node', 'os', 'version'].sort()
    );
    expect(body.properties.$process_person_profile).toBe(false);
    expect(body.properties.$ip).toBeNull();
    expect(body.properties.$geoip_disable).toBe(true);
  });

  it('non contiene percorsi né nomi utente', () => {
    const text = JSON.stringify(buildEvent(EVENT.started, 'abc', info));
    expect(text).not.toContain(process.cwd());
    expect(text).not.toContain(process.env.USER ?? '\u0000');
  });
});

describe('sendTelemetry', () => {
  it('invia started e active_day al primo avvio del giorno', async () => {
    const send = vi.fn().mockResolvedValue({});
    await run({ send });
    expect(send.mock.calls.map(([b]) => b.event)).toEqual(['npx_feega_started', 'npx_feega_active_day']);
  });

  it('active_day una sola volta al giorno', async () => {
    const dir = home();
    const send = vi.fn().mockResolvedValue({});
    await run({ home: dir, send });
    send.mockClear();
    await run({ home: dir, send });
    expect(send.mock.calls.map(([b]) => b.event)).toEqual(['npx_feega_started']);
  });

  it('non lancia se l’invio fallisce', async () => {
    const send = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(run({ send })).resolves.toBeUndefined();
  });

  it('non lancia se la cartella non è scrivibile', async () => {
    const send = vi.fn().mockResolvedValue({});
    await expect(run({ home: '/dev/null/x', send })).resolves.toBeUndefined();
  });
});

describe('opt-out', () => {
  it.each([
    [{ FEEGA_TELEMETRY: '0' }],
    [{ DO_NOT_TRACK: '1' }],
    [{ CI: 'true' }]
  ])('non invia con %j', async (env) => {
    const dir = home();
    const send = vi.fn();
    await run({ home: dir, send, env });
    expect(send).not.toHaveBeenCalled();
    expect(existsSync(join(dir, '.feega'))).toBe(false);
  });

  it('isOptedOut è falso senza segnali', () => {
    expect(isOptedOut({})).toBe(false);
    expect(isOptedOut({ FEEGA_TELEMETRY: '1' })).toBe(false);
  });
});

describe('avviso', () => {
  it('compare solo alla prima esecuzione', async () => {
    const dir = home();
    const notify = vi.fn();
    const send = vi.fn().mockResolvedValue({});
    await run({ home: dir, send, notify });
    await run({ home: dir, send, notify });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(NOTICE);
    expect(NOTICE).toContain('FEEGA_TELEMETRY=0');
  });
});
