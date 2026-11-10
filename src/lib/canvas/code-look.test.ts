import { describe, expect, it } from 'vitest';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { baselined } from './code-look';

describe('baselined', () => {
  it('la base diventa ciò che la tela mostra, così un passaggio dell’import che ritocca un colore non sembra una modifica', () => {
    const clip = { id: 'a', component: 'Text', props: { text: 'Home', color: '#111111' }, source: { at: 'x.svelte:1:0', was: { text: 'Home', color: '#121212' } } };
    const doc = { width: 100, height: 100, tracks: [{ clips: [clip] }], comps: { c: { tracks: [{ clips: [{ ...clip, id: 'b' }] }] } } } as unknown as MotionDoc;
    const done = baselined(doc);
    expect(done.tracks[0].clips[0].source?.was).toEqual({ text: 'Home', color: '#111111' });
    expect(done.comps.c.tracks[0].clips[0].source?.was).toEqual({ text: 'Home', color: '#111111' });
  });
});
