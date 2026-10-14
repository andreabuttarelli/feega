import { describe, it, expect } from 'vitest';
import { asSchema, type Tool } from 'ai';
import { fakeDb } from '$lib/server/db/fake-db';
import { createProjectTools } from './project-tools';
import { createMotionDelegation } from './motion-delegation';
import { createFrameTools } from './frame-tools';
import { motionToolList, motionToolSpec } from '$lib/server/motion/tool-run';

const SCOPE = { orgId: 'o', projectId: 'p', userId: 'u' };
const FRAME_TOOLS_MAX_CHARS = 4_000;
const CANVAS_CHAT_MAX_CHARS = 22_000;
const EDITOR_TO_FRAME_TOOLS_RATIO = 35;

async function promptChars(tools: Record<string, Tool>): Promise<number> {
  const sizes = await Promise.all(Object.entries(tools).map(async ([name, t]) => name.length + String(t.description ?? '').length + JSON.stringify(await asSchema(t.inputSchema).jsonSchema).length));
  return sizes.reduce((a, b) => a + b, 0);
}

async function editorChars(): Promise<number> {
  const specs = await Promise.all(motionToolList().map((t) => motionToolSpec(t.name)));
  return specs.reduce((sum, s) => sum + s!.name.length + s!.description.length + JSON.stringify(s!.input_schema).length, 0);
}

describe('the canvas chat reaches every frame tool without carrying them in its prompt', () => {
  const { db } = fakeDb({});
  const frame = createFrameTools({ db, ...SCOPE, open: null, editor: null });
  const canvas = { ...createProjectTools({ db, ...SCOPE }), ...createMotionDelegation({ db, ...SCOPE, origin: 'https://feega.test' }), ...frame };

  it('the frame tools cost a fraction of the editor toolset they reach', async () => {
    const frameChars = await promptChars(frame);

    expect(frameChars).toBeLessThan(FRAME_TOOLS_MAX_CHARS);
    expect(await editorChars()).toBeGreaterThan(frameChars * EDITOR_TO_FRAME_TOOLS_RATIO);
  });

  it('the canvas chat surface stays under its budget with the frame tools in', async () => {
    expect(await promptChars(canvas)).toBeLessThan(CANVAS_CHAT_MAX_CHARS);
  });
});
