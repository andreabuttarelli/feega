import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { THREE_D_COMPONENTS } from '$lib/motion/components';
import { createMotionTools, type MotionSession } from './motion-tools';

type Run = (name: string, input: unknown) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run: Run = (name, input) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

type Catalogue = { library: { id: string; props: Record<string, string> }[] };

async function shownRange(run: Run, component: string, key: string): Promise<[number, number]> {
  const catalogue = (await run('list_components', {})) as unknown as Catalogue;
  const [min, max] = catalogue.library.find((c) => c.id === component)!.props[key].split('..').map(Number);
  return [min, max];
}

const PLACEMENT = ['x', 'y', 'width', 'height'] as const;

describe('3D clips: the catalogue and add_clip speak the same units', () => {
  for (const component of THREE_D_COMPONENTS) {
    for (const key of PLACEMENT) {
      it(`${component}.${key}: the catalogue max lands on the frame edge`, async () => {
        const { session, run } = setup();
        const [, max] = await shownRange(run, component, key);
        const out = await run('add_clip', { component, start: 0, props: { [key]: max } });
        expect(out.ok, String(out.error)).toBe(true);
        expect(findClip(session.doc, String(out.clip_id))!.clip.props[key]).toBeCloseTo(1, 3);
      });

      it(`${component}.${key}: out of range is refused in catalogue units`, async () => {
        const { run } = setup();
        const [, max] = await shownRange(run, component, key);
        const out = await run('add_clip', { component, start: 0, props: { [key]: max * 2 } });
        expect(out.ok).toBe(false);
        expect(String(out.error)).toContain(String(max));
      });
    }
  }
});
