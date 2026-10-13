import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import StillExport from './StillExport.svelte';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';

const props = (saved: boolean) => ({ doc: { ...newMotionDoc(MotionFormat.Portrait), still: { frame: 0 } }, editorUrl: '/p/p1/c/c1/motion/n1', fileName: 'poster', saved, onclose: () => {} });

describe('the still export dialog', () => {
  it('offers png, jpg and webp at 1x and 2x with the pixel size', () => {
    const body = render(StillExport, { props: props(true) }).body;

    expect(body).toContain('value="png"');
    expect(body).toContain('value="jpg"');
    expect(body).toContain('value="webp"');
    expect(body).toContain('1080×1350');
    expect(body).toContain('2160×2700');
  });

  it('waits for the save: it draws the saved version', () => {
    const body = render(StillExport, { props: props(false) }).body;

    expect(body).toMatch(/<button[^>]*disabled[^>]*data-testid="still-export-go"/);
  });
});
