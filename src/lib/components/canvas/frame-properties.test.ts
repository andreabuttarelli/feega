import { describe, expect, it } from 'vitest';
import { FrameProperties, typingInBar } from './frame-properties.svelte';
import { DocMode } from '$lib/motion/doc';

describe('frame properties handed to the right bar', () => {
  it('holds the session of the frame being edited until it is cleared', () => {
    const props = new FrameProperties();
    const session = { name: 'session' } as never;

    props.publish('n1', session, { name: 'tokens' } as never, null);
    expect(props.session).toBe(session);

    props.clear();
    expect(props.session).toBeNull();
    expect(props.tokens).toBeNull();
    expect(props.extras).toBeNull();
  });

  it('tells the chat agent which frame is open, so it can ask this tab to draw it', () => {
    const props = new FrameProperties();
    const session = { selection: ['c1'], history: { present: { still: null } } } as never;

    expect(props.openFrame()).toBeNull();

    props.publish('n1', session, {} as never, null);
    expect(props.openFrame()).toEqual({ nodeId: 'n1', selection: ['c1'], playhead: 0, mode: DocMode.Video });

    props.clear();
    expect(props.openFrame()).toBeNull();
  });
});

describe('typing in the bar', () => {
  const field = (value: string, inBar: boolean) => ({ tagName: 'TEXTAREA', value, closest: () => (inBar ? {} : null) }) as unknown as Element;

  it('a filled field in the bar is typing', () => {
    expect(typingInBar(field('hello', true))).toBe(true);
  });

  it('an empty field, a field outside the bar, or no focus is not', () => {
    expect(typingInBar(field('', true))).toBe(false);
    expect(typingInBar(field('hello', false))).toBe(false);
    expect(typingInBar(null)).toBe(false);
  });
});
