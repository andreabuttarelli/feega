import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { figmaMessage } from './archive';
import { LayerKind, figmaScene } from './scene';

const clip = readFileSync(new URL('../../../../tests/fixtures/figma/clip-1.html', import.meta.url), 'utf8');

describe('a real Figma clipboard', () => {
  it('decodes the fig-kiwi archive and its figmeta', () => {
    const message = figmaMessage(clip);
    expect(message?.meta.fileKey).toBe('PwswsA9kgYS8mkYzLjp2nq');
    expect(message?.nodes.map((n) => n.type)).toContain('TEXT');
  });

  it('maps the copied frame to an editable layer tree', () => {
    const scene = figmaScene(figmaMessage(clip)!);
    expect(scene).toMatchSnapshot();
  });

  it('keeps the text editable with its font, tracking and leading', () => {
    const root = figmaScene(figmaMessage(clip)!)!.root;
    const text = root.children.find((l) => l.kind === LayerKind.Text);
    expect(text).toMatchObject({ text: 'dal \nnulla', font: 'Archivo', weight: 700, size: 240, letterSpacing: '-7%', lineHeight: '83%', color: '#ffffff', box: { x: 559, y: 341 } });
  });

  it('turns vector networks into closed paths inside the frame', () => {
    const root = figmaScene(figmaMessage(clip)!)!.root;
    const ghost = root.children.find((l) => l.kind === LayerKind.Frame);
    const paths = ghost?.kind === LayerKind.Frame ? ghost.children.filter((l) => l.kind === LayerKind.Shape) : [];
    expect(paths).toHaveLength(3);
    expect(paths.every((p) => p.kind === LayerKind.Shape && p.path.startsWith('M') && p.path.endsWith('Z'))).toBe(true);
  });

  it('ignores html without a Figma archive', () => {
    expect(figmaMessage('<p>hi</p>')).toBeNull();
  });
});
