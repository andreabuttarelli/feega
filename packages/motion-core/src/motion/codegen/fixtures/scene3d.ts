import { newClip } from '../../doc';
import { parseProps, type ComponentId } from '../../components';
import { Ease } from '../../design';
import type { Keyframes } from '../../keyframes';
import { box, DocKit, type Px } from './kit';

export const MODEL_ASSET = 'toy-model';
export const MODEL_URL = 'https://x.supabase.co/storage/v1/object/sign/canvas-assets/o/p/toy.glb?token=abc';

type Placed = { id: string; name?: string; component: ComponentId; at: Px; props: Record<string, unknown>; keyframes?: Keyframes; frames?: number };

function withScene(kit: DocKit, placed: Placed) {
  const unit = { x: (placed.at.left + placed.at.width / 2) / kit.width, y: (placed.at.top + placed.at.height / 2) / kit.height, width: placed.at.width / kit.width, height: placed.at.height / kit.height };
  const parsed = parseProps(placed.component, { ...placed.props, ...unit });
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  kit.tracks()[0].clips.push(newClip({ id: placed.id, from: 0, durationInFrames: placed.frames ?? 120, component: placed.component, name: placed.name ?? placed.id, props: parsed.props, ...(placed.keyframes ? { keyframes: placed.keyframes } : {}) }));
}

export function sceneDoc(extra: Placed[] = []) {
  const kit = new DocKit(1280, 720);
  kit.frame('page', { name: 'Page', box: box(0, 0, 1280, 720), fill: '#ffffff' });
  kit.text('title', 'Meet the toy', { name: 'Title', parent: 'page', size: 56, weight: 700, box: box(80, 120, 520, 80) });
  const doc = kit.doc();
  const scenes: Placed[] = [
    { id: 'toy', name: 'Toy model', component: 'Model3D', at: box(640, 60, 560, 600), props: { assetId: MODEL_ASSET, startAngle: -30, endAngle: 150, easing: Ease.Standard, lighting: 'studio', shadow: true } },
    ...extra
  ];
  scenes.forEach((s) => withScene(kit, s));
  return { ...doc, durationInFrames: 120, tracks: kit.tracks() };
}

export const SCENE_ASSETS = { [MODEL_ASSET]: MODEL_URL };


export const showcaseDoc = () => sceneDoc([{ id: 'ring', name: 'Ring', component: 'Shape3D', at: box(80, 320, 400, 380), props: { shape: 'torus', fill: '#e11d48', material: 'plastic', lighting: 'dramatic' } }]);
