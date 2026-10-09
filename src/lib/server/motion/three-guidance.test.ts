import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { motionAgentPrompt } from './motion-prompt';
import { Vision } from './frames';
import { createMotionTools, type MotionSession } from './motion-tools';
import { THREE_GUIDANCE } from './three-guidance';

describe('three.js guidance for the agent', () => {
  it('the prompt and write_component point at three.renderer and the perf checklist', () => {
    const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
    const tools = createMotionTools({ session, assets: [], newId: () => 'id', voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
    const schema = JSON.stringify(z.toJSONSchema((tools.write_component as Tool & { inputSchema: z.ZodType }).inputSchema));

    expect(THREE_GUIDANCE).toContain('three.renderer(canvas)');
    expect(THREE_GUIDANCE).toContain('InstancedMesh');
    expect(motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Missing })).toContain(THREE_GUIDANCE);
    expect(schema).toContain(THREE_GUIDANCE);
  });
});
