import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { haptic, systemShare } = await import('./native-actions');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('native actions', () => {
  it('a haptic in the iOS shell is a native tap, since WebKit has no navigator.vibrate', () => {
    const impact = vi.fn(async () => undefined);
    const vibrate = vi.fn();
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true, Plugins: { Haptics: { impact } } });
    vi.stubGlobal('navigator', { vibrate });

    haptic(10);

    expect(impact).toHaveBeenCalledWith({ style: 'LIGHT' });
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('a haptic in a browser vibrates where the browser can', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });

    haptic(10);

    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it('the system share sheet exists only in the shell', async () => {
    const share = vi.fn(async () => ({}));
    expect(systemShare()).toBeNull();

    vi.stubGlobal('Capacitor', { isNativePlatform: () => true, Plugins: { Share: { share } } });
    await systemShare()?.({ title: 'Board', url: 'https://feega.app/s/x' });

    expect(share).toHaveBeenCalledWith({ title: 'Board', url: 'https://feega.app/s/x' });
  });
});
