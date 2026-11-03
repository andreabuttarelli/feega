import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import StillExport from './StillExport.svelte';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';

const props = (saved: boolean, docScale = 1) => ({ doc: { ...newMotionDoc(MotionFormat.Portrait), still: { frame: 0 } }, docScale, editorUrl: '/p/p1/c/c1/motion/n1', fileName: 'poster', saved, onclose: () => {} });

describe('the still export dialog', () => {
  it('offers png, jpg and webp at 1x and 2x with the pixel size', () => {
    const body = render(StillExport, { props: props(true) }).body;

    expect(body).toContain('value="png"');
    expect(body).toContain('value="jpg"');
    expect(body).toContain('value="webp"');
    expect(body).toContain('1080×1350');
    expect(body).toContain('2160×2700');
  });

  it('sizes 1x and 2x on the frame as it is on the canvas, 2x picked first', () => {
    const body = render(StillExport, { props: props(true, 0.5) }).body;

    expect(body).toContain('1x · 540×675');
    expect(body).toMatch(/<option value="2" selected="">2x · 1080×1350/);
  });

  it('waits for the save: it draws the saved version', () => {
    const body = render(StillExport, { props: props(false) }).body;

    expect(body).toMatch(/<button[^>]*disabled[^>]*data-testid="still-export-go"/);
  });
});
