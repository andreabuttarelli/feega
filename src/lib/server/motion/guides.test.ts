import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';
import { GUIDES, GuideTopic } from './guides';
import { WRITE_COMPONENT } from './model-route';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

const ORB = { name: 'Orb', html: '<canvas></canvas>', css: '', js: 'const renderer = new THREE.WebGLRenderer({ canvas: root.querySelector("canvas") }); renderer.setPixelRatio(2); tl.to({}, { duration, onUpdate() { renderer.render(new THREE.Scene(), new THREE.PerspectiveCamera()); } });' };
const CARD = { name: 'Card', html: '<div class="c"></div>', css: '', js: 'tl.from(root.querySelector(".c"), { opacity: 0, duration: 0.4 });' };

function setup() {
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => 'id', voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(async () => ({ ok: true, problems: [], frames: [] })) });
  let call = 0;
  return (input: unknown) => (tools[WRITE_COMPONENT] as Tool & { execute: Exec }).execute(input, { toolCallId: `c${++call}` });
}

describe('guides attached to code writes', () => {
  it('a 3D component gets the performance guide once per turn and its measurable faults as warnings', async () => {
    const write = setup();

    const first = await write(ORB);
    const second = await write(ORB);

    expect(first.ok).toBe(true);
    expect(first.guide).toBe(GUIDES[GuideTopic.ThreePerformance].text);
    expect(String(first.warnings)).toContain('setPixelRatio');
    expect(second.guide).toBeUndefined();
    expect(String(second.warnings)).toContain('WebGLRenderer');
  });

  it('a component without WebGL gets neither', async () => {
    const result = await setup()(CARD);

    expect(result.guide).toBeUndefined();
    expect(result.warnings).toBeUndefined();
  });
});
