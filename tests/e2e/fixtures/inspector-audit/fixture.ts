import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';
import { MotionFormat, newClip, newMotionDoc, parseMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { EFFECT_KINDS, EffectKind, defaultValues } from '@feega/motion-core/motion/effects/registry';
import { PropertyKind } from '@feega/motion-core/motion/property-resolve';
import { defineProperty } from '../../../../src/lib/motion/component-properties';
import { defineVariantProp } from '../../../../src/lib/motion/variants';
import { setConstraints } from '../../../../src/lib/motion/constraints/constraints';
import { Horizontal } from '@feega/motion-core/motion/constraints/model';
import { createComponent, overrideInstance } from '../../../../src/lib/motion/main-component';
import { homed, placeInstance } from '../../../../src/lib/motion/canvas-components';
import { groupClips } from '../../../../src/lib/motion/group';
import { useAsMask } from '../../../../src/lib/motion/mask-group';
import { addEffect } from '../../../../src/lib/motion/effects/ops';
import { FillType, newFill } from '@feega/motion-core/motion/fill/model';
import excerpt from './stripe-excerpt.json' with { type: 'json' };

export const PLACE = { projectId: '00000000-0000-4000-8000-0000000a0d01', canvasId: '00000000-0000-4000-8000-0000000a0d02' };
export const KINDS_NODE = '00000000-0000-4000-8000-0000000a0d10';
export const IMPORTED_NODE = '00000000-0000-4000-8000-0000000a0d11';
export const AREAS_NODE = '00000000-0000-4000-8000-0000000a0d12';
export const MAINS_NODE = '00000000-0000-4000-8000-0000000a0d13';
export const IMAGE_ASSET = '00000000-0000-4000-8000-0000000a0d20';

const LOCAL_USER = '00000000-0000-4000-8000-00000000f001';
const IMAGE_FILE = `assets/${LOCAL_USER}/${PLACE.projectId}/blue-square.png`;
const EXPORTED_AT = '2026-11-12T00:00:00.000Z';
const STRIPE_WIDTH = 1280;
const GAP = 200;

export enum Layer {
  Rect = 'rect',
  Ellipse = 'ellipse',
  Line = 'line',
  Star = 'star',
  Vector = 'vector',
  Text = 'text',
  Image = 'image',
  Stack = 'stack',
  StackChild = 'stack-a',
  Group = 'group',
  Instance = 'instance',
  Masked = 'masked',
  Mask = 'mask',
  Shadowed = 'shadowed',
  Styled = 'styled',
  Bound = 'bound',
  Null = 'null',
  Gradient = 'gradient',
  Card = 'card',
  CardInstance = 'card-instance',
  CardComp = 'card-comp',
  ImageFill = 'image-fill',
  MixA = 'mix-a',
  MixB = 'mix-b',
  Frame = 'frame',
  ImportedText = '0752f883',
  ImportedPill = '1c47f19d',
  ImportedCard = '3dd72cde'
}

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

let made = 0;
const newId = () => `ia${++made}`;

type Place = { x: number; y: number; width: number; height: number };
const at = (p: Place) => ({ ...p, align: 'center' });

function add(doc: MotionDoc, id: string, component: string, place: Place, props: Record<string, unknown>): MotionDoc {
  return must(addClip(doc, { component: component as MotionClip['component'], from: 0, durationInFrames: 150, props: { ...at(place), ...props } }, id));
}

const patched = (doc: MotionDoc, id: string, patch: Partial<MotionClip>): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)) })) });

const solid = (color: string) => [{ type: 'solid', color }];

function kindsDoc(): MotionDoc {
  let doc: MotionDoc = { ...newMotionDoc(MotionFormat.Square), still: { frame: 0 }, background: 'transparent' } as MotionDoc;
  doc = { ...doc, styles: { 'Brand/Accent': { kind: 'colour', color: '#7c3aed' }, 'Soft shadow': { kind: 'effect', effects: [{ id: 'fx1', kind: EffectKind.DropShadow, enabled: true, params: defaultValues(EffectKind.DropShadow) }] }, Heading: { kind: 'text', size: 0.05, weight: 700 } } } as MotionDoc;
  doc = { ...doc, variables: { Theme: { modes: ['Light', 'Dark'], vars: { Ink: { type: 'colour', values: { Light: '#111827', Dark: '#f9fafb' } }, Brand: { type: 'colour', values: { Light: '#2563eb', Dark: '#60a5fa' } } } } } } as MotionDoc;
  doc = { ...doc, assets: [{ id: IMAGE_ASSET, kind: 'image' }] } as MotionDoc;

  doc = add(doc, Layer.Rect, 'Shape', { x: 0.12, y: 0.1, width: 0.18, height: 0.14 }, { shape: 'rect', fills: solid('#ff5a1f'), roundness: 0 });
  doc = add(doc, Layer.Ellipse, 'Shape', { x: 0.35, y: 0.1, width: 0.16, height: 0.14 }, { shape: 'ellipse', fills: solid('#2563eb') });
  doc = add(doc, Layer.Line, 'Shape', { x: 0.6, y: 0.1, width: 0.2, height: 0.004 }, { shape: 'line', strokes: [{ paint: { type: 'solid', color: '#111827' }, width: 0.006 }] });
  doc = add(doc, Layer.Star, 'Shape', { x: 0.85, y: 0.1, width: 0.14, height: 0.14 }, { shape: 'star', fills: solid('#f59e0b') });
  doc = add(doc, Layer.Vector, 'Shape', { x: 0.12, y: 0.32, width: 0.16, height: 0.14 }, { shape: 'path', path: 'M0 1L0.5 0L1 1Z', fills: solid('#10b981') });
  doc = add(doc, Layer.Text, 'Text', { x: 0.45, y: 0.32, width: 0.4, height: 0.08 }, { text: 'Plain text layer', size: 0.04, color: '#111827' });
  doc = add(doc, Layer.Image, 'Image', { x: 0.82, y: 0.32, width: 0.16, height: 0.16 }, { assetId: IMAGE_ASSET });

  doc = add(doc, Layer.Stack, 'Shape', { x: 0.25, y: 0.55, width: 0.4, height: 0.14 }, { shape: 'rect', fills: solid('#e5e7eb') });
  doc = patched(doc, Layer.Stack, { autoLayout: { direction: 'horizontal', gap: 16, padding: { top: 16, right: 16, bottom: 16, left: 16 }, justify: 'start', align: 'center' } as MotionClip['autoLayout'] });
  doc = add(doc, Layer.StackChild, 'Shape', { x: 0.12, y: 0.55, width: 0.08, height: 0.08 }, { shape: 'rect', fills: solid('#ef4444') });
  doc = patched(doc, Layer.StackChild, { parent: Layer.Stack, layoutItem: { width: 'fixed', height: 'fixed' } as MotionClip['layoutItem'] });
  doc = add(doc, 'stack-b', 'Shape', { x: 0.22, y: 0.55, width: 0.08, height: 0.08 }, { shape: 'rect', fills: solid('#22c55e') });
  doc = patched(doc, 'stack-b', { parent: Layer.Stack, layoutItem: { width: 'fixed', height: 'fixed' } as MotionClip['layoutItem'] });

  doc = add(doc, 'group-a', 'Shape', { x: 0.62, y: 0.55, width: 0.1, height: 0.1 }, { shape: 'rect', fills: solid('#a855f7') });
  doc = add(doc, 'group-b', 'Shape', { x: 0.74, y: 0.55, width: 0.1, height: 0.1 }, { shape: 'ellipse', fills: solid('#ec4899') });
  doc = must(groupClips(doc, ['group-a', 'group-b'], () => (made++ % 2 ? Layer.Group : 'group-comp')));

  doc = add(doc, 'button-label', 'Text', { x: 0.9, y: 0.55, width: 0.16, height: 0.06 }, { text: 'Buy now', size: 0.035, color: '#ffffff', fills: solid('#111827') });
  doc = must(createComponent(doc, ['button-label'], () => (made++ % 2 ? Layer.Instance : 'button-comp'), 'Button'));

  doc = add(doc, Layer.Mask, 'Shape', { x: 0.12, y: 0.8, width: 0.16, height: 0.16 }, { shape: 'ellipse', fills: solid('#000000') });
  doc = add(doc, Layer.Masked, 'Shape', { x: 0.12, y: 0.8, width: 0.2, height: 0.12 }, { shape: 'rect', fills: solid('#0ea5e9') });
  doc = must(useAsMask(doc, [Layer.Mask, Layer.Masked]));

  doc = add(doc, Layer.Shadowed, 'Shape', { x: 0.36, y: 0.8, width: 0.16, height: 0.14 }, { shape: 'rect', fills: solid('#ffffff'), roundness: 0.2 });
  doc = must(addEffect(doc, Layer.Shadowed, EffectKind.DropShadow, 'shadow1'));

  doc = add(doc, Layer.Styled, 'Shape', { x: 0.6, y: 0.8, width: 0.16, height: 0.14 }, { shape: 'rect', fills: solid('#7c3aed') });
  doc = patched(doc, Layer.Styled, { effectStyleRef: 'Soft shadow' });
  doc = add(doc, Layer.Bound, 'Text', { x: 0.85, y: 0.8, width: 0.24, height: 0.06 }, { text: 'Bound heading', size: 0.05, weight: 700, color: '#2563eb' });
  doc = patched(doc, Layer.Bound, { bind: { color: 'Theme/Brand' }, styleRef: 'Heading' });
  doc = must(addClip(doc, { component: 'Null', from: 0, durationInFrames: 150, props: { x: 0.5, y: 0.95 } }, Layer.Null));
  doc = add(doc, Layer.Gradient, 'Shape', { x: 0.85, y: 0.95, width: 0.14, height: 0.06 }, { shape: 'rect', fills: [newFill(FillType.Linear, '#ff0000')], strokes: [{ paint: { type: 'solid', color: '#111827' }, width: 0.004 }] });

  return doc;
}

export const effectLayer = (kind: EffectKind) => `fx-${kind}`;
export const effectId = (kind: EffectKind) => `e-${kind}`;

const EFFECT_COLUMNS = 6;

function areasDoc(): MotionDoc {
  let doc: MotionDoc = { ...newMotionDoc(MotionFormat.Square), still: { frame: 0 }, background: 'transparent' } as MotionDoc;
  doc = { ...doc, assets: [{ id: IMAGE_ASSET, kind: 'image' }] } as MotionDoc;

  doc = add(doc, Layer.ImageFill, 'Shape', { x: 0.65, y: 0.12, width: 0.2, height: 0.18 }, { shape: 'rect', fills: [{ ...newFill(FillType.Image), assetId: IMAGE_ASSET }] });

  doc = add(doc, Layer.MixA, 'Shape', { x: 0.15, y: 0.4, width: 0.12, height: 0.1 }, { shape: 'rect', fills: solid('#f97316'), roundness: 0 });
  doc = add(doc, Layer.MixB, 'Shape', { x: 0.35, y: 0.42, width: 0.16, height: 0.08 }, { shape: 'rect', fills: solid('#0ea5e9'), roundness: 0.3 });
  doc = patched(doc, Layer.MixB, { blend: 'multiply' } as Partial<MotionClip>);
  doc = must(setConstraints(doc, [Layer.MixB], { horizontal: Horizontal.Right }));

  EFFECT_KINDS.forEach((kind, i) => {
    const place = { x: 0.1 + (i % EFFECT_COLUMNS) * 0.15, y: 0.6 + Math.floor(i / EFFECT_COLUMNS) * 0.08, width: 0.1, height: 0.06 };
    doc = add(doc, effectLayer(kind), 'Shape', place, { shape: 'rect', fills: solid('#6366f1') });
    doc = must(addEffect(doc, effectLayer(kind), kind, effectId(kind)));
  });

  return doc;
}

function mainsDoc(): MotionDoc {
  let doc: MotionDoc = { ...newMotionDoc(MotionFormat.Square), still: { frame: 0 }, background: 'transparent' } as MotionDoc;
  doc = add(doc, 'card-bg', 'Shape', { x: 0.2, y: 0.12, width: 0.3, height: 0.18 }, { shape: 'rect', fills: solid('#f3f4f6'), roundness: 0.1 });
  doc = add(doc, 'card-title', 'Text', { x: 0.17, y: 0.1, width: 0.2, height: 0.05 }, { text: 'Pro plan', size: 0.035, color: '#111827' });
  doc = add(doc, 'card-badge', 'Text', { x: 0.3, y: 0.17, width: 0.08, height: 0.04 }, { text: 'New', size: 0.025, color: '#ffffff', fills: solid('#ef4444') });
  const cardIds = [Layer.CardComp, Layer.Card];
  doc = must(createComponent(doc, ['card-bg', 'card-title', 'card-badge'], () => cardIds.shift()!, 'Card'));
  doc = must(defineProperty(doc, Layer.CardComp, 'Title', { kind: PropertyKind.Text, target: 'card-title', default: 'Pro plan' }));
  doc = must(defineProperty(doc, Layer.CardComp, 'Show badge', { kind: PropertyKind.Boolean, target: 'card-badge', default: true }));
  doc = must(defineVariantProp(doc, Layer.CardComp, 'Size', ['Small', 'Large'], newId));

  return homed(doc, MAINS_NODE);
}

function withInstance(areas: MotionDoc, mains: MotionDoc): MotionDoc {
  const doc = must(placeInstance(areas, mains, Layer.CardComp, () => Layer.CardInstance));
  return must(overrideInstance(doc, Layer.CardInstance, 'card-bg', { fills: solid('#dbeafe') }));
}

function importedDoc(): MotionDoc {
  const base = newMotionDoc(MotionFormat.Custom);
  const clips = excerpt.clips.map((c) => newClip(c as unknown as MotionClip));
  return {
    ...base,
    width: STRIPE_WIDTH,
    height: excerpt.height,
    background: 'transparent',
    styles: excerpt.styles,
    variables: excerpt.variables,
    tracks: [{ ...base.tracks[0], clips }, base.tracks[1]]
  } as MotionDoc;
}

const node = (id: string, displayName: string, x: number, doc: MotionDoc) => ({
  id,
  type: 'motion',
  displayName,
  position: { x, y: 0, z: 0 },
  size: { width: doc.width, height: doc.height },
  data: { format: 'custom', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null }
});

export function auditDocs(): Record<string, MotionDoc> {
  made = 0;
  const kinds = kindsDoc();
  const imported = importedDoc();
  const mains = mainsDoc();
  return { [KINDS_NODE]: kinds, [IMPORTED_NODE]: imported, [AREAS_NODE]: withInstance(areasDoc(), mains), [MAINS_NODE]: mains };
}

export function writeAuditFile(file: string): void {
  const docs = auditDocs();
  for (const [id, doc] of Object.entries(docs)) {
    const verdict = parseMotionDoc(doc);
    if (!verdict.ok) {
      throw new Error(`fixture ${id}: ${verdict.error}`);
    }
  }
  const kinds = docs[KINDS_NODE];
  const nodes = [node(KINDS_NODE, 'Every kind', 0, kinds), node(IMPORTED_NODE, 'Stripe excerpt (imported)', kinds.width + GAP, docs[IMPORTED_NODE]), node(AREAS_NODE, 'More areas', -(docs[AREAS_NODE].width + GAP), docs[AREAS_NODE]), node(MAINS_NODE, 'Components', -2 * (docs[AREAS_NODE].width + GAP), docs[MAINS_NODE])];
  const heads = Object.fromEntries(Object.entries(docs).map(([id, doc]) => [id, { version: 1, doc }]));
  const assets = [{ id: IMAGE_ASSET, type: 'image', mimeType: 'image/png', width: 64, height: 64, durationS: null, content: null, url: null, file: IMAGE_FILE }];
  const manifest = { format: 'feega', version: 1, exportedAt: EXPORTED_AT, canvasName: 'inspector audit', source: PLACE };
  const picture = readFileSync(fileURLToPath(new URL('../blue-square.png', import.meta.url)));
  writeFileSync(file, zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)), 'canvas.json': strToU8(JSON.stringify({ nodes, connections: [], heads, assets })), [IMAGE_FILE]: picture }));
}
