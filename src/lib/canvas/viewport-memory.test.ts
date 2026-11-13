import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrashRecorder } from './gpu/crash-record';

const memory = () => import('./viewport-memory');

const shelf = () => {
  const items = new Map<string, string>();
  return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v), removeItem: (k: string) => void items.delete(k) };
};

describe('the remembered viewport', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it('reopens where the person left the canvas', async () => {
    vi.stubGlobal('localStorage', shelf());
    const { loadViewport, rememberViewport } = await memory();
    rememberViewport('u', 'c', { x: 10, y: 20, zoom: 0.4 });

    expect(loadViewport('u', 'c')).toEqual({ x: 10, y: 20, zoom: 0.4 });
  });

  it('forgets the view a page died in, so a reload after the phone killed it does not reopen the same heavy view', async () => {
    const storage = shelf();
    vi.stubGlobal('localStorage', storage);
    const { loadViewport, rememberViewport } = await memory();
    rememberViewport('u', 'c', { x: 10, y: 20, zoom: 0.05 });
    new CrashRecorder(storage).begin();

    expect(loadViewport('u', 'c')).toBeNull();
  });

  it('keeps reading the saved view after this session marks itself open', async () => {
    const storage = shelf();
    vi.stubGlobal('localStorage', storage);
    const { loadViewport, rememberViewport } = await memory();
    rememberViewport('u', 'c', { x: 1, y: 2, zoom: 1 });

    expect(loadViewport('u', 'c')).toEqual({ x: 1, y: 2, zoom: 1 });
    new CrashRecorder(storage).begin();
    expect(loadViewport('u', 'c')).toEqual({ x: 1, y: 2, zoom: 1 });
  });
});
