import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cardOverElements, elementsOnly } from '../../../../tests/fixtures/figma/elements';
import { figmaMessage } from './archive';
import { Cross, Destination, Fit, Flow, Justify, LayerKind, figmaScene, type FrameLayer } from './scene';

const clip = readFileSync(new URL('../../../../tests/fixtures/figma/clip-1.html', import.meta.url), 'utf8');

const frameOf = (layer: { kind: LayerKind }) => layer as FrameLayer;

describe('a real Figma clipboard', () => {
  it('decodes the fig-kiwi archive and its figmeta', () => {
    const message = figmaMessage(clip);
    expect(message?.meta.fileKey).toBe('PwswsA9kgYS8mkYzLjp2nq');
    expect(message?.nodes.map((n) => n.type)).toContain('TEXT');
  });

  it('maps the copied frame to one frame placement with an editable layer tree', () => {
    const scene = figmaScene(figmaMessage(clip)!);
    expect(scene?.placements.map((p) => p.destination)).toEqual([Destination.Frame]);
    expect(scene).toMatchSnapshot();
  });

  it('keeps the text editable with its font, tracking and leading', () => {
    const root = frameOf(figmaScene(figmaMessage(clip)!)!.placements[0].layer);
    const text = root.children.find((l) => l.kind === LayerKind.Text);
    expect(text).toMatchObject({ text: 'dal \nnulla', font: 'Archivo', weight: 700, size: 240, letterSpacing: '-7%', lineHeight: '83%', color: '#ffffff', box: { x: 559, y: 341 } });
  });

  it('turns vector networks into closed paths inside the frame', () => {
    const root = frameOf(figmaScene(figmaMessage(clip)!)!.placements[0].layer);
    const ghost = root.children.find((l) => l.kind === LayerKind.Frame);
    const paths = ghost?.kind === LayerKind.Frame ? ghost.children.filter((l) => l.kind === LayerKind.Shape) : [];
    expect(paths).toHaveLength(3);
    expect(paths.every((p) => p.kind === LayerKind.Shape && p.path.startsWith('M') && p.path.endsWith('Z'))).toBe(true);
  });

  it('ignores html without a Figma archive', () => {
    expect(figmaMessage('<p>hi</p>')).toBeNull();
  });
});

describe('what you copy keeps its kind', () => {
  it('shapes, text and groups stay free elements, one per top-level node', () => {
    const scene = figmaScene(elementsOnly())!;
    expect(scene.placements.map((p) => [p.destination, p.layer.kind])).toEqual([
      [Destination.Free, LayerKind.Shape],
      [Destination.Free, LayerKind.Shape],
      [Destination.Free, LayerKind.Text],
      [Destination.Free, LayerKind.Frame]
    ]);
  });

  it('keeps the relative positions around the middle of what was copied', () => {
    const [first, , , last] = figmaScene(elementsOnly())!.placements;
    expect(last.centre.x).toBeGreaterThan(first.centre.x);
    expect(last.centre.y).toBeGreaterThan(first.centre.y);
  });

  it('a frame next to free elements is the only frame', () => {
    const scene = figmaScene(cardOverElements())!;
    expect(scene.placements.filter((p) => p.destination === Destination.Frame)).toHaveLength(1);
    expect(scene.placements.filter((p) => p.destination === Destination.Free)).toHaveLength(4);
  });

  it('puts everything of a mixed copy inside one wrapper when pasted into a frame', () => {
    const { combined } = figmaScene(cardOverElements())!;
    expect(combined.name).toBe('Figma paste');
    expect(combined.children).toHaveLength(5);
  });

  it('a lone frame is pasted into a frame as itself', () => {
    expect(figmaScene(figmaMessage(clip)!)!.combined.name).toBe('Cover');
  });
});

describe('what the Figma layer looks like', () => {
  it('keeps the rotation of text and the stacks of fills and strokes', () => {
    const scene = figmaScene(elementsOnly())!;
    const [rect, , text] = scene.placements.map((p) => p.layer);
    expect(text).toMatchObject({ rotation: -90 });
    expect(rect.kind === LayerKind.Shape && rect.fills).toHaveLength(2);
    expect(rect.kind === LayerKind.Shape && rect.strokes).toHaveLength(2);
    expect(rect.kind === LayerKind.Shape && rect.fills.map((f) => f.kind)).toEqual(['solid', 'linear']);
  });

  it('measures a rotated element by what it covers, and keeps rotated text inside its box', () => {
    const [rect, , text] = figmaScene(elementsOnly())!.placements;
    expect(text.size.width).toBeGreaterThanOrEqual(160);
    expect(text.size.height).toBeGreaterThanOrEqual(160);
    expect(rect.size.width).toBeGreaterThan(200);
  });

  it('reads Figma auto layout as direction, gap, padding, alignment and sizing', () => {
    const card = figmaScene(cardOverElements())!.placements.find((p) => p.destination === Destination.Frame)!.layer;
    expect(frameOf(card).autoLayout).toEqual({
      flow: Flow.Row,
      wrap: false,
      gap: 16,
      crossGap: 16,
      padding: { top: 12, right: 24, bottom: 14, left: 20 },
      justify: Justify.SpaceBetween,
      align: Cross.Center,
      width: Fit.Fixed,
      height: Fit.Hug
    });
    expect(frameOf(card).children.map((c) => c.item.grow)).toEqual([false, true]);
  });
});
