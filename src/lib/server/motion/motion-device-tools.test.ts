import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('device tools', () => {
  it('a laptop mockup opens its lid with a preset', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Device3D', start: 0, duration: 4, props: { device: 'laptop-pro' } });
    const id = session.doc.tracks.flatMap((t) => t.clips)[0].id;
    await run('apply_device_preset', { clip_id: id, preset: 'lid-open' });
    expect(findClip(session.doc, id)!.clip.keyframes.lid?.map((k) => k.value)).toEqual([0, 110]);
  });

  it('adds a row of three phones', async () => {
    const { session, run } = setup();
    const result = await run('add_device_row', { device: 'phone', start: 0, duration: 5 });
    expect(result).not.toHaveProperty('error');
    expect(session.doc.tracks.flatMap((t) => t.clips).filter((c) => c.component === 'Device3D')).toHaveLength(3);
  });

  it('the agent knows each screen aspect and how a source fits it', async () => {
    const { run } = setup();
    const catalogue = (await run('list_components', {})) as unknown as { library: { id: string; about: string; props: Record<string, string> }[] };
    const device = catalogue.library.find((c) => c.id === 'Device3D')!;

    expect(device.about).toContain('phone-pro 1206×2622 (9:19.6)');
    expect(device.about).toContain('monitor 5120×2880 (16:9)');
    expect(device.props.screenFit).toBe('cover|contain|safe');
  });

  it('builds UI on its own screen frame and puts it live on a phone', async () => {
    const { session, run } = setup();
    const comp = await run('create_comp', { name: 'App', width: 390, height: 848, duration: 4 });
    expect(comp.ok, String(comp.error)).toBe(true);
    const inside = await run('edit_comp', { comp: comp.comp, calls: [{ tool: 'add_clip', input: { component: 'Title', start: 0, props: { text: 'Daily Loop', x: 195, width: 390 } } }] });
    expect(inside.ok, JSON.stringify(inside)).toBe(true);
    const phone = await run('add_clip', { component: 'Device3D', start: 0, duration: 4, props: { screenComp: comp.comp } });
    expect(phone.ok, String(phone.error)).toBe(true);

    const title = session.doc.comps[String(comp.comp)].tracks.flatMap((t) => t.clips)[0];
    expect(session.doc.comps[String(comp.comp)].frame).toEqual({ width: 390, height: 848 });
    expect([title.props.x, title.props.width]).toEqual([0.5, 1]);
  });
});
