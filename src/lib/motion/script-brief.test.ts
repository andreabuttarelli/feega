import { describe, expect, it } from 'vitest';
import { BRIEF_AUTO_GO_S, GO_MESSAGE, briefAwaits, pendingBoard, pendingBrief, promptTexts, savedBrief } from './script-brief';
import { MotionFormat, newMotionDoc } from './doc';
import { toolsForMirror } from '$lib/chat-stream-events';

const written = { toolName: 'write_script', status: 'done' as const, output: { ok: true, brief: '**Research**\n- For: makers' } };
const refused = { toolName: 'write_script', status: 'done' as const, output: { ok: false, error: 'read the site first' } };

describe('script brief', () => {
  it('reads the brief out of a saved write_script result only', () => {
    expect(savedBrief(written)).toBe('**Research**\n- For: makers');
    expect(savedBrief(refused)).toBeNull();
    expect(savedBrief({ toolName: 'add_clip', output: { ok: true, brief: 'x' } })).toBeNull();
  });

  it('waits for the user when the last assistant turn saved a script', () => {
    const messages = [
      { role: 'user' as const, content: 'make a launch video' },
      { role: 'assistant' as const, content: '', tools: [written] }
    ];
    expect(pendingBrief(messages)).toBe('**Research**\n- For: makers');
  });

  it('keeps a long brief whole when the reply row is saved, so a reload still shows it', () => {
    const long = { ...written, toolCallId: 'c1', output: { ok: true, brief: `**Research**\n${'- a sourced claim\n'.repeat(200)}` } };
    const saved = [{ role: 'assistant' as const, content: '', tools: toolsForMirror([long]) }];
    expect(pendingBrief(saved)).toBe(long.output.brief);
  });

  it('stops waiting once the user answered, or while the turn still streams', () => {
    const asked = [{ role: 'assistant' as const, content: '', tools: [written] }];
    const go = { role: 'user' as const, content: GO_MESSAGE };
    expect(pendingBrief([...asked, go])).toBeNull();
    expect(pendingBrief([{ ...asked[0], live: true }])).toBeNull();
    expect(pendingBrief([{ role: 'assistant', content: '', tools: [refused] }])).toBeNull();
  });

  it('pauses the turn on the step that saved the script', () => {
    const step = (toolName: string, output: unknown) => ({ content: [{ type: 'tool-result', toolName, output }] });
    expect(briefAwaits([step('analyze_site', {}), step('write_script', written.output)])).toBe(true);
    expect(briefAwaits([step('write_script', refused.output)])).toBe(false);
    expect(briefAwaits([step('write_script', written.output), step('add_clip', { ok: true })])).toBe(false);
  });

  it('gives the user a few seconds before it builds on its own', () => {
    expect(BRIEF_AUTO_GO_S).toBeGreaterThanOrEqual(5);
    expect(BRIEF_AUTO_GO_S).toBeLessThanOrEqual(15);
  });
});

describe('screening the go message', () => {
  it('screens the go together with the script it builds: alone it reads as a script nobody can see', () => {
    const doc = { ...newMotionDoc(MotionFormat.Landscape), script: { research: { promise: { text: 'Every site you run.' } }, acts: [] } } as unknown as Parameters<typeof promptTexts>[1];

    expect(promptTexts(GO_MESSAGE, newMotionDoc(MotionFormat.Landscape))).toEqual([GO_MESSAGE]);
    expect(promptTexts(GO_MESSAGE, doc)).toHaveLength(2);
  });
});


describe('the storyboard next to the brief', () => {
  const outline = [{ act: 'problem', intensity: 0.3, branch: false }];
  const board = { toolName: 'write_storyboard', output: { ok: true, canvas_id: 'board', outline } };

  it('reads the board the same turn wrote, even through the mirrored row', () => {
    expect(pendingBoard([{ role: 'assistant', content: '', tools: toolsForMirror([board, written]) }])).toEqual({ canvasId: 'board', outline });
  });

  it('has none when the turn wrote none, or it was refused', () => {
    expect(pendingBoard([{ role: 'assistant', content: '', tools: [written] }])).toBeNull();
    expect(pendingBoard([{ role: 'assistant', content: '', tools: [{ toolName: 'write_storyboard', output: { ok: false } }] }])).toBeNull();
  });
});
