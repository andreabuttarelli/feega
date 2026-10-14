import { describe, expect, it } from 'vitest';
import { handoffOf, handoffPath, withoutHandoff } from './chat-handoff';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('a prompt handed from the home to the canvas chat', () => {
  it('rides in the canvas URL, with its attachments', () => {
    const path = handoffPath({ projectId: 'p1', canvasId: 'c1' }, 'a launch poster series', [UUID]);

    expect(path).toBe(`/p/p1/c/c1?prompt=a+launch+poster+series&attach=${UUID}`);
    expect(handoffOf(new URL(`http://x${path}`))).toEqual({ text: 'a launch poster series', attachmentIds: [UUID] });
  });

  it('a canvas opened without a prompt hands nothing off', () => {
    expect(handoffOf(new URL('http://x/p/p1/c/c1'))).toBeNull();
    expect(handoffOf(new URL('http://x/p/p1/c/c1?prompt=%20%20'))).toBeNull();
  });

  it('is removed from the URL once taken, so a reload never sends it twice', () => {
    const clean = withoutHandoff(new URL(`http://x/p/p1/c/c1?prompt=hi&attach=${UUID}&welcome=x`));

    expect(clean.search).toBe('?welcome=x');
  });
});
