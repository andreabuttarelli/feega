import { describe, expect, it } from 'vitest';
import { FrameProperties, typingInBar } from './frame-properties.svelte';
import { DocMode } from '@feega/motion-core/motion/doc';

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

  it('names the frame being edited, and forgets the name when cleared', () => {
    const props = new FrameProperties();

    expect(props.name).toBe('Frame');

    props.name = 'Landing page';
    expect(props.name).toBe('Landing page');

    props.clear();
    expect(props.name).toBe('Frame');
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

describe('what the right bar routes to properties', () => {
  it('a frame selected on its own, with no element picked inside it', () => {
    const props = new FrameProperties();
    expect(props.routed).toBeNull();

    props.publish('n1', { selection: [] } as never, {} as never, null);
    expect(props.routed).toBe('n1');
  });

  it('changes when an element inside the frame is picked', () => {
    const props = new FrameProperties();
    props.publish('n1', { selection: ['c1', 'c2'] } as never, {} as never, null);

    expect(props.routed).toBe('n1:c1,c2');

    props.clear();
    expect(props.routed).toBeNull();
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
