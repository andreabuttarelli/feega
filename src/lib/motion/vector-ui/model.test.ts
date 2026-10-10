import { describe, expect, it } from 'vitest';
import { VectorHint, VectorKind, VectorRole, cropUi, mergeRuns, vectorUi, withinBudget, type RawCapture, type RawNode } from './model';

const letter = (text: string, x: number, extra: Partial<RawNode> = {}): RawNode => ({ kind: VectorKind.Text, hint: VectorHint.None, x, y: 20, w: 10, h: 16, text, font: 'Inter', size: 16, weight: 400, color: 'rgb(0, 0, 0)', ...extra });

const capture = (nodes: RawNode[]): RawCapture => ({ url: 'https://x.test', title: 'X', width: 1280, height: 800, background: 'rgb(255, 255, 255)', nodes });

describe('a page read as vector UI', () => {
  it('joins the letters a site animates one by one back into the words they spell', () => {
    const merged = mergeRuns([letter('F', 20), letter('e', 30), letter('e', 40), letter('g', 50), letter('a', 60), letter('P', 78)]);

    expect(merged.map((n) => n.text)).toEqual(['Feega P']);
  });

  it('keeps apart runs on different lines or in different styles', () => {
    const merged = mergeRuns([letter('a', 20), letter('b', 30, { y: 60 }), letter('c', 40, { y: 60, weight: 700 })]);

    expect(merged.map((n) => n.text)).toEqual(['a', 'b', 'c']);
  });

  it('names every element by its role, so a shot can type into input-0 or press button-0', () => {
    const ui = vectorUi(
      capture([
        { kind: VectorKind.Box, hint: VectorHint.Input, x: 400, y: 300, w: 600, h: 56, fill: 'rgb(250, 250, 250)' },
        letter('Paste your website', 420, { hint: VectorHint.Input, y: 318 }),
        letter('Create', 1100, { hint: VectorHint.Button }),
        letter('12,400', 200, { y: 500 }),
        letter('make a video.', 500, { y: 180, size: 64, h: 70, w: 340 })
      ])
    );

    expect(ui.nodes.map((n) => n.id)).toEqual(['input-0', 'input-1', 'button-0', 'stat-0', 'heading-0']);
  });

  it('drops what lies outside the viewport and flags pictures it could not rebuild as vectors', () => {
    const ui = vectorUi(capture([letter('below', 20, { y: 900 }), { kind: VectorKind.Image, hint: VectorHint.None, x: 0, y: 0, w: 400, h: 300, src: 'https://x.test/a.png' }]));

    expect(ui.nodes).toHaveLength(1);
    expect(ui.raster).toEqual(['image-0']);
    expect(ui.nodes[0]).not.toHaveProperty('src');
  });

  it('fits a size budget by dropping icons and small boxes before any text', () => {
    const icons = Array.from({ length: 30 }, (_, i): RawNode => ({ kind: VectorKind.Icon, hint: VectorHint.None, x: i * 20, y: 0, w: 16, h: 16, svg: `<svg>${'p'.repeat(200)}</svg>` }));
    const ui = vectorUi(capture([...icons, letter('keep me', 20, { y: 200 })]));

    const fitted = withinBudget(ui, 1_000, (u) => JSON.stringify(u).length);

    expect(JSON.stringify(fitted).length).toBeLessThanOrEqual(1_000);
    expect(fitted.nodes.filter((n) => n.role === VectorRole.Text).map((n) => n.text)).toEqual(['keep me']);
  });

  it('crops to a region, moving the elements into its coordinates', () => {
    const ui = vectorUi(capture([letter('in', 420, { y: 320 }), letter('out', 20, { y: 20 })]));

    const cropped = cropUi(ui, { x: 400, y: 300, w: 300, h: 100 });

    expect(cropped.nodes.map((n) => [n.text, n.x, n.y])).toEqual([['in', 20, 20]]);
    expect([cropped.width, cropped.height]).toEqual([300, 100]);
  });
});
