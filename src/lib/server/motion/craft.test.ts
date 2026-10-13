import { describe, expect, it, vi } from 'vitest';
import { BUILTIN_TEMPLATES } from '$lib/motion/template/builtins';
import { GLOBE_TEMPLATE_ID } from '$lib/motion/template/image-globe/template';
import { COMPARE_REFERENCE, CRAFT_TOOLS, TARGET_SCORE, compareReferenceTool, craftInput, craftRun, craftSystem, templateSource, type ChildCall, type CraftPorts } from './craft';
import { VIEW_FRAMES } from './frames';
import { WRITE_COMPONENT } from './model-route';

const REF = { mediaType: 'image/jpeg', data: 'cmVm' };
const FRAME = { width: 1080, height: 1920 };

function ports(over: Partial<CraftPorts> = {}): CraftPorts {
  return {
    references: vi.fn(async () => [REF]),
    run: vi.fn(async () => ({ text: 'built Aurora in 3 rounds', usd: 1.8, calls: ['v1', 'v2', 'v3'].map(view) })),
    sheet: vi.fn(async (callId: string) => `org/p/uploads/web-views/${callId}/sheet.jpg`),
    remainingUsd: () => 4,
    ...over
  };
}

const view = (id: string): ChildCall => ({ toolCallId: id, toolName: VIEW_FRAMES, input: { times: [0, 4] }, output: { ok: true } });
const compare = (id: string, score: number): ChildCall => ({ toolCallId: id, toolName: COMPARE_REFERENCE, input: { score, differences: [`difference ${id}`] }, output: { ok: true } });
const measured = (id: string): ChildCall => ({ toolCallId: id, toolName: 'check_motion', input: { from: 2 }, output: { ok: true, jolts: [{ time: 2.3, kind: 'pop' }], frozen: [] } });

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
        return { text: 'ok', usd: 1, calls: [] };
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

  it('keeps a log per round: the sheet of its look, the motion it measured, the differences and the score it gave itself', async () => {
    const calls = [view('v1'), measured('m1'), compare('c1', 6), view('v2'), compare('c2', 8)];
    const p = ports({ run: vi.fn(async () => ({ text: 'done', usd: 2, calls })) });

    const out = await craftRun(p, ask, { session: {}, frame: FRAME });

    expect(out).toMatchObject({ ok: true, rounds: 2, best_score: 8 });
    expect(out.ok && out.log).toEqual([
      { round: 1, score: 6, differences: ['difference c1'], motion: { jolts: [{ time: 2.3, kind: 'pop' }], frozen: [] }, sheet: 'org/p/uploads/web-views/v1/sheet.jpg' },
      { round: 2, score: 8, differences: ['difference c2'], motion: null, sheet: 'org/p/uploads/web-views/v2/sheet.jpg' }
    ]);
  });

  it('reports each round as it closes, so the chat shows progress while the agent works', async () => {
    const seen: number[] = [];
    const p = ports({
      run: vi.fn(async (a) => {
        a.onCalls([view('v1'), compare('c1', 5)]);
        a.onCalls([view('v1'), compare('c1', 5), view('v2'), compare('c2', 7)]);
        return { text: 'done', usd: 2, calls: [view('v1'), compare('c1', 5), view('v2'), compare('c2', 7)] };
      })
    });

    await craftRun(p, ask, { session: {}, frame: FRAME, progress: (r) => seen.push(r.log.length) });

    expect(seen).toEqual([1, 2]);
  });

  it('refuses without a reference it can see, before spending anything', async () => {
    const p = ports({ references: vi.fn(async () => []) });

    expect(await craftRun(p, ask, { session: {}, frame: FRAME })).toMatchObject({ ok: false, error: expect.stringContaining('reference') });
    expect(p.run).not.toHaveBeenCalled();
  });

  it('asked for more than is left, it spends what is left instead of refusing (eval craft: $3 asked, $2.52 left)', async () => {
    const p = ports({ remainingUsd: () => 1.2 });

    await craftRun(p, ask, { session: {}, frame: FRAME });

    expect(vi.mocked(p.run).mock.calls[0][0].budgetUsd).toBe(1.2);
  });

  it('refuses only when too little is left for one round', async () => {
    const p = ports({ remainingUsd: () => 0.1 });

    expect(await craftRun(p, ask, { session: {}, frame: FRAME })).toMatchObject({ ok: false, error: expect.stringContaining('budget') });
    expect(p.run).not.toHaveBeenCalled();
  });
});

describe('what the crafting agent is told', () => {
  it('the loop: study exemplars, write, look next to the reference, measure motion, fix, for the rounds asked', () => {
    const system = craftSystem(FRAME);

    for (const step of [COMPARE_REFERENCE, 'supersampl', 'cluster', 'read_template_source', WRITE_COMPONENT, VIEW_FRAMES, 'check_motion', 'update_components', 'expose_field', 'save_template']) {
      expect(system).toContain(step);
    }
    expect(system).toMatch(/still\(t\)/);
    expect(system).toMatch(/three\.renderer/);
  });

  it('the crafting tools write code and see frames', () => {
    expect(CRAFT_TOOLS).toEqual(expect.arrayContaining([WRITE_COMPONENT, VIEW_FRAMES, 'read_template_source', 'check_motion']));
  });
});

describe('compare_reference', () => {
  it('asks for another round below the target score', async () => {
    const run = (score: number) => (compareReferenceTool.execute as (i: unknown, o: unknown) => Promise<Record<string, unknown>>)({ score, differences: ['bubbles too big'] }, {});

    expect(await run(TARGET_SCORE - 1)).toMatchObject({ ok: true, keep_going: true });
    expect(await run(TARGET_SCORE)).toMatchObject({ ok: true, keep_going: false });
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
