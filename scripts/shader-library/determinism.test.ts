import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SHADER_LIBRARY } from '../../packages/shader-fx/src/library';
import { openHarness, type Harness } from './harness';

const SIZE = { width: 320, height: 180 };
const BROWSER_START_MS = 60_000;

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, BROWSER_START_MS);

afterAll(async () => {
  await harness?.close();
});

const defaults = (name: string) => Object.fromEntries(SHADER_LIBRARY.find((s) => s.name === name)!.params.map((p) => [p.key, p.default]));

describe('shader library frames', () => {
  it.each(SHADER_LIBRARY.map((s) => s.name))('%s renders the same pixels for the same time and params', async (name) => {
    const frame = { name, time: 2.37, values: defaults(name), ...SIZE };

    const first = await harness.render(frame);
    await harness.render({ ...frame, time: 4.1 });
    const second = await harness.render(frame);

    expect(second.equals(first)).toBe(true);
  });

  it.each(SHADER_LIBRARY.map((s) => s.name))('%s moves with time', async (name) => {
    const frame = { name, values: defaults(name), ...SIZE };

    const early = await harness.render({ ...frame, time: 0.5 });
    const late = await harness.render({ ...frame, time: 3 });

    expect(late.equals(early)).toBe(false);
  });
});
