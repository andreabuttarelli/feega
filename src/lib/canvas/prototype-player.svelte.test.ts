import { describe, expect, it } from 'vitest';
import { PrototypePlayerSession } from './prototype-player.svelte';

describe('PrototypePlayerSession', () => {
  it('opens on the frame being edited and closes again', () => {
    const session = new PrototypePlayerSession();
    session.editing = 'f1';

    session.play();
    expect(session.start).toBe('f1');

    session.stop();
    expect(session.start).toBeNull();
  });

  it('has nothing to play without a frame being edited', () => {
    const session = new PrototypePlayerSession();

    session.play();

    expect(session.start).toBeNull();
  });
});
