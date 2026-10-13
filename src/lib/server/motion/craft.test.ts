import { describe, expect, it, vi } from 'vitest';
import { BUILTIN_TEMPLATES } from '$lib/motion/template/builtins';
import { GLOBE_TEMPLATE_ID } from '$lib/motion/template/image-globe/template';
import { CRAFT_TOOLS, craftInput, craftRun, craftSystem, templateSource, type CraftPorts } from './craft';
import { VIEW_FRAMES } from './frames';
import { WRITE_COMPONENT } from './model-route';

const REF = { mediaType: 'image/jpeg', data: 'cmVm' };
const FRAME = { width: 1080, height: 1920 };

function ports(over: Partial<CraftPorts> = {}): CraftPorts {
  return {
    references: vi.fn(async () => [REF]),
    run: vi.fn(async () => ({ text: 'built Aurora in 3 rounds', usd: 1.8, views: ['v1', 'v2', 'v3'] })),
    sheet: vi.fn(async (callId: string) => `org/p/uploads/web-views/${callId}/sheet.jpg`),
    remainingUsd: () => 4,
    ...over
  };
}

const ask = craftInput.parse({ brief: 'iridescent blobs drifting behind a short title', reference_asset_ids: ['a1'] });

describe('craftRun', () => {
  it('runs the crafting agent with the reference pictures in its first message and the craft tools only', async () => {
    const p = ports();

    await craftRun(p, ask, { session: {}, frame: FRAME });

    const sent = vi.mocked(p.run).mock.calls[0][0];
    expect(sent.content).toEqual([expect.objectContaining({ type: 'text' }), { type: 'image', image: REF.data, mediaType: REF.mediaType }]);
    expect(sent.tools).toEqual(CRAFT_TOOLS);
    expect(sent.budgetUsd).toBe(ask.budget_usd);
  });

  it('every view_frames of the crafting agent sees the references next to its frames, and the turn gets its own back after', async () => {
    const earlier = [{ mediaType: 'image/png', data: 'b2xk' }];
    const session = { references: earlier };
    let during: unknown = null;
    const p = ports({
      run: vi.fn(async () => {
        during = session.references;
        return { text: 'ok', usd: 1, views: [] };
      })
    });

    await craftRun(p, ask, { session, frame: FRAME });

    expect(during).toEqual([REF]);
    expect(session.references).toBe(earlier);
  });

  it('reports one round per look, with a contact sheet of each round for the chat', async () => {
    const out = await craftRun(ports(), ask, { session: {}, frame: FRAME });

    expect(out).toMatchObject({ ok: true, rounds: 3, cost_usd: 1.8, text: 'built Aurora in 3 rounds' });
    expect(out.ok && out.images.map((i) => i.path)).toEqual(['v1', 'v2', 'v3'].map((id) => `org/p/uploads/web-views/${id}/sheet.jpg`));
  });

  it('refuses without a reference it can see, before spending anything', async () => {
    const p = ports({ references: vi.fn(async () => []) });

    expect(await craftRun(p, ask, { session: {}, frame: FRAME })).toMatchObject({ ok: false, error: expect.stringContaining('reference') });
    expect(p.run).not.toHaveBeenCalled();
  });

  it('refuses a budget the turn does not have', async () => {
    const p = ports({ remainingUsd: () => 1 });

    expect(await craftRun(p, ask, { session: {}, frame: FRAME })).toMatchObject({ ok: false, error: expect.stringContaining('budget') });
    expect(p.run).not.toHaveBeenCalled();
  });
});

describe('what the crafting agent is told', () => {
  it('the loop: study exemplars, write, look next to the reference, measure motion, fix, for the rounds asked', () => {
    const system = craftSystem(FRAME);

    for (const step of ['read_template_source', WRITE_COMPONENT, VIEW_FRAMES, 'check_motion', 'update_components', 'expose_field', 'save_template']) {
      expect(system).toContain(step);
    }
    expect(system).toMatch(/still\(t\)/);
    expect(system).toMatch(/three\.renderer/);
  });

  it('the crafting tools write code and see frames', () => {
    expect(CRAFT_TOOLS).toEqual(expect.arrayContaining([WRITE_COMPONENT, VIEW_FRAMES, 'read_template_source', 'check_motion']));
  });
});

describe('templateSource', () => {
  it('gives the code of a library template, its fields and how long it runs', () => {
    const globe = BUILTIN_TEMPLATES.find((t) => t.id === GLOBE_TEMPLATE_ID)!;

    const source = templateSource(globe);

    expect(source).toMatchObject({ id: GLOBE_TEMPLATE_ID, name: 'Image globe', seconds: 10, fps: 30 });
    expect(source.components[0]).toMatchObject({ name: 'ImageGlobe', js: expect.stringContaining('ig-globe') });
    expect(source.key_fields).toEqual(['title', 'media', 'background', 'turns']);
  });
});
