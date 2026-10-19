import { describe, expect, it } from 'vitest';
import { capturePainted } from './capture';

const NO_FRAME = new Error('cdpSession.send: Protocol error (Page.captureScreenshot): Unable to capture screenshot');

describe('capturePainted', () => {
  it('retries after a painted frame when the compositor had none yet', async () => {
    const calls: string[] = [];
    let failures = 2;
    const shot = await capturePainted(
      async () => {
        calls.push('shot');
        if (failures-- > 0) {
          throw NO_FRAME;
        }
        return 'png';
      },
      async () => {
        calls.push('paint');
      }
    );

    expect(shot).toBe('png');
    expect(calls).toEqual(['shot', 'paint', 'shot', 'paint', 'shot']);
  });

  it('gives up after a bounded number of frames', async () => {
    let shots = 0;
    const capture = capturePainted(
      async () => {
        shots++;
        throw NO_FRAME;
      },
      async () => {}
    );

    await expect(capture).rejects.toThrow('Unable to capture screenshot');
    expect(shots).toBeLessThan(10);
  });

  it('never retries any other error', async () => {
    let shots = 0;
    const capture = capturePainted(
      async () => {
        shots++;
        throw new Error('Target closed');
      },
      async () => {}
    );

    await expect(capture).rejects.toThrow('Target closed');
    expect(shots).toBe(1);
  });
});
