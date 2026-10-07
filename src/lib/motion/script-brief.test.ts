import { describe, expect, it } from 'vitest';
import { BRIEF_AUTO_GO_S, GO_MESSAGE, briefAwaits, pendingBrief, savedBrief } from './script-brief';

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
