import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { markSeen, onboardingState } from './onboarding-state';

const home = () => mkdtemp(join(tmpdir(), 'onb-'));

describe('onboarding state', () => {
  it('reads a missing file as never seen', async () => {
    expect(await onboardingState(await home())).toEqual({ seenAt: null });
  });

  it('reads a corrupt file as never seen', async () => {
    const dir = await home();
    await mkdir(join(dir, '.feega'));
    await writeFile(join(dir, '.feega', 'onboarding.json'), '{nope');

    expect(await onboardingState(dir)).toEqual({ seenAt: null });
  });

  it('remembers when it was seen', async () => {
    const dir = await home();
    await markSeen(dir, new Date('2026-11-18T10:00:00Z'));

    expect(await onboardingState(dir)).toEqual({ seenAt: '2026-11-18T10:00:00.000Z' });
  });
});
