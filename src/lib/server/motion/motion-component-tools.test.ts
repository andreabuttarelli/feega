import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { CheckState } from '$lib/motion/custom/component';
import { createMotionTools, MAX_CODE_WRITES_PER_TURN, type CheckResult, type MotionSession, type MotionToolDeps } from './motion-tools';
import { WRITE_COMPONENT } from './model-route';
import { motionAgentPrompt } from './motion-prompt';
import { Vision } from './frames';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

const CHAT = {
  name: 'ChatPanel',
  html: '<div class="panel"><p class="line"></p></div>',
  css: '.panel{position:absolute;inset:10%;background:#111}',
  js: 'const line = root.querySelector(".line"); tl.to({}, { duration: duration, onUpdate() { line.textContent = props.message.slice(0, Math.round(this.progress() * props.message.length)); } });',
  props_schema: { type: 'object', properties: { message: { type: 'string', default: 'Make a reel for the spring drop' } } }
};

const PASSED: CheckResult = { ok: true, problems: [], frames: [] };

function setup(check: MotionToolDeps['check'] = vi.fn(async () => PASSED)) {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const deps: MotionToolDeps = {
    session,
    assets: [],
    newId: () => `id${++n}`,
    voiceover: vi.fn(),
    frames: vi.fn(async () => null),
    check
  };
  const tools = createMotionTools(deps);
  let call = 0;
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: `call-${++call}` });
  const schema = (name: string) => (tools[name] as Tool & { inputSchema: { safeParse: (x: unknown) => { success: boolean } } }).inputSchema;
  return { session, run, deps, schema };
}

describe('component tools', () => {
  it('write_component saves the code, runs the determinism check and records it', async () => {
    const { session, run, deps } = setup();
    const out = await run(WRITE_COMPONENT, CHAT);

    expect(out).toMatchObject({ ok: true, version: 1, check: CheckState.Passed });
    expect(deps.check).toHaveBeenCalledWith('call-1', expect.objectContaining({ components: expect.objectContaining({ ChatPanel: expect.anything() }) }), 'ChatPanel');
    expect(session.doc.components.ChatPanel.check?.state).toBe(CheckState.Passed);
    expect(session.edits).toEqual(['wrote ChatPanel']);
  });

  it('a component that fails the check comes back as an error with the offending frames for the next step', async () => {
    const frames = [{ time: 1, bytes: Buffer.from([1]) }, { time: 1, bytes: Buffer.from([2]) }];
    const { session, run } = setup(vi.fn(async () => ({ ok: false, problems: ['the frame at 1s differs between visits'], frames })));
    const out = await run(WRITE_COMPONENT, CHAT);

    expect(out.ok).toBe(false);
    expect(String(out.error)).toContain('differs between visits');
    expect(session.frames.get('call-1')).toEqual(frames);
    expect(session.doc.components.ChatPanel.check?.state).toBe(CheckState.Failed);
  });

  it('takes the props schema as an object or as a JSON string', async () => {
    const { run, schema } = setup();

    expect(schema(WRITE_COMPONENT).safeParse(CHAT).success).toBe(true);
    expect((await run(WRITE_COMPONENT, { ...CHAT, props_schema: JSON.stringify(CHAT.props_schema) })).ok).toBe(true);
  });

  it('counts refused writes against the per-turn cap too', async () => {
    const { session, run } = setup();
    await run(WRITE_COMPONENT, { ...CHAT, js: 'setInterval(() => {}, 16);' });

    expect(session.codeWrites).toBe(1);
  });

  it('code that breaks the contract never reaches the preview', async () => {
    const { run, deps } = setup();
    const out = await run(WRITE_COMPONENT, { ...CHAT, js: 'setInterval(() => {}, 16);' });

    expect(out.ok).toBe(false);
    expect(deps.check).not.toHaveBeenCalled();
  });

  it('patch_component edits one file and checks again', async () => {
    const { session, run, deps } = setup();
    await run(WRITE_COMPONENT, CHAT);
    const out = await run('patch_component', { name: 'ChatPanel', edits: [{ file: 'css', find: 'inset:10%', replace: 'inset:8%' }] });

    expect(out).toMatchObject({ ok: true, version: 2 });
    expect(session.doc.components.ChatPanel.source.css).toContain('inset:8%');
    expect(deps.check).toHaveBeenCalledTimes(2);
  });

  it('read_component returns the code and list_components lists library and custom components', async () => {
    const { run } = setup();
    await run(WRITE_COMPONENT, CHAT);

    expect(await run('read_component', { name: 'ChatPanel' })).toMatchObject({ ok: true, html: CHAT.html, js: CHAT.js, version: 1 });
    const listed = (await run('list_components', {})) as unknown as { library: { id: string }[]; custom: { name: string }[] };
    expect(listed.custom.map((c) => c.name)).toEqual(['ChatPanel']);
    expect(listed.library.some((c) => c.id === 'Title')).toBe(true);
  });

  it('a custom clip is added with add_clip and its props come from the component schema', async () => {
    const { session, run } = setup();
    await run(WRITE_COMPONENT, CHAT);
    const out = await run('add_clip', { component: 'Custom', start: 0, duration: 4, props: { name: 'ChatPanel', message: 'Plan my week' } });

    expect(out.ok).toBe(true);
    expect(findClip(session.doc, 'id1')?.clip.props).toEqual({ name: 'ChatPanel', message: 'Plan my week' });
  });

  it('stops writing code after the per-turn cap', async () => {
    const { session, run } = setup();
    session.codeWrites = MAX_CODE_WRITES_PER_TURN;

    expect((await run(WRITE_COMPONENT, CHAT)).ok).toBe(false);
  });
});

describe('the authoring contract in the prompt', () => {
  it('names what the static check refuses and how to animate instead', () => {
    const prompt = motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Available, frame: { width: 1080, height: 1920 } });

    for (const name of ['setTimeout', 'requestAnimationFrame', 'fetch', 'Math.random', '@keyframes', 'tl', 'rand()', '1080×1920']) {
      expect(prompt).toContain(name);
    }
  });
});
