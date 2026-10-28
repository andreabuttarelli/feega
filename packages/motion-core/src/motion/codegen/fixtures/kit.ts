import { Background, DOC_VERSION, newClip, type MotionClip, type MotionDoc, type MotionTrack } from '../../doc';
import { TrackKind, type ComponentId } from '../../components';
import { FPS } from '../../design';
import { DEFAULT_MOTION_BLUR } from '../../motion-blur';
import { DEFAULT_AUTO_LAYOUT, DEFAULT_LAYOUT_ITEM, type AutoLayout, type LayoutItem } from '../../layout/model';
import { Sizing } from '../../layout/auto-layout';
import type { TextRun } from '../../text-runs';
import type { Keyframes } from '../../keyframes';
import type { Interaction } from '../../prototype/model';

export type Px = { left: number; top: number; width: number; height: number };

type Common = { parent?: string; box?: Px; item?: Partial<LayoutItem>; name?: string; animate?: Keyframes; interactions?: Interaction[] };

export type FrameOptions = Common & { fill?: string | null; radius?: number; stroke?: { color: string; width: number; sides?: [number, number, number, number] }; layout?: Partial<AutoLayout>; clip?: boolean; shadow?: { y: number; blur: number; opacity: number } };

export type TextOptions = Common & { size: number; weight?: number; color?: string; font?: string; leading?: number; tracking?: number; align?: 'left' | 'center' | 'right'; runs?: TextRun[]; component?: Extract<ComponentId, 'Text' | 'Title' | 'Kicker'>; textCase?: 'upper' };

const FRAMES = 30;
const MAX_ROUNDNESS = 0.5;
const DEFAULT_FONT = 'Inter';
const GOOGLE_WEIGHTS = [400, 500, 600, 700];
const ZERO_BOX: Px = { left: 0, top: 0, width: 100, height: 40 };

export class DocKit {
  private readonly clips: MotionClip[] = [];
  private readonly families = new Set<string>();
  readonly comps: MotionDoc['comps'] = {};

  constructor(
    readonly width: number,
    readonly height: number
  ) {}

  private get unit() {
    return Math.min(this.width, this.height);
  }

  private placed(box: Px = ZERO_BOX) {
    return { x: (box.left + box.width / 2) / this.width, y: (box.top + box.height / 2) / this.height, width: box.width / this.width, height: box.height / this.height };
  }

  private add(id: string, component: ComponentId, props: Record<string, unknown>, options: Common, extra: Partial<MotionClip> = {}) {
    const placed = component === 'Precomp' ? {} : this.placed(options.box);
    const clip = newClip({ id, from: 0, durationInFrames: FRAMES, component, props: { ...placed, ...props }, name: options.name, parent: options.parent ?? null, ...(options.item ? { layoutItem: { ...DEFAULT_LAYOUT_ITEM, ...options.item } } : {}), ...(options.animate ? { keyframes: options.animate } : {}), ...(options.interactions ? { interactions: options.interactions } : {}), ...extra });
    this.clips.push(clip);
    return id;
  }

  frame(id: string, options: FrameOptions): string {
    const fills = options.fill ? [{ type: 'solid', color: options.fill, opacity: 1, visible: true, blend: 'normal' }] : [];
    const side = Math.min(options.box?.width ?? 1, options.box?.height ?? 1);
    const strokes = options.stroke ? [{ paint: { type: 'solid', color: options.stroke.color, opacity: 1, visible: true, blend: 'normal' }, width: options.stroke.width / this.unit, ...(options.stroke.sides ? { sides: options.stroke.sides.map((w) => w / this.unit) } : {}), align: 'inside', dash: 0, gap: 0, cap: 'butt', join: 'miter', miter: 4, startCap: 'none', endCap: 'none', visible: true }] : [];
    const effects = options.shadow ? [{ id: `${id}-shadow`, kind: 'drop-shadow', enabled: true, params: { distance: 0, angle: 90, x: 0, y: options.shadow.y, blur: options.shadow.blur, spread: 0, color: '#0b1220', opacity: options.shadow.opacity, behind: 1 } }] : [];
    const props = { shape: 'rect', fills, strokes, roundness: options.radius ? Math.min(MAX_ROUNDNESS, options.radius / side) : 0 };
    const layout = options.layout ? { autoLayout: { ...DEFAULT_AUTO_LAYOUT, strokesIncluded: true, ...options.layout } } : {};
    return this.add(id, 'Shape', props, options, { ...layout, ...(options.clip ? { clipContent: true } : {}), effects: effects as MotionClip['effects'] });
  }

  text(id: string, text: string, options: TextOptions): string {
    this.families.add(options.font ?? DEFAULT_FONT);
    const props = { text, size: options.size / this.unit, weight: options.weight ?? 400, color: options.color ?? '#0b1220', font: options.font ?? DEFAULT_FONT, leading: options.leading ?? 1.4, tracking: options.tracking ?? 0, align: options.align ?? 'left', ...(options.runs ? { runs: options.runs } : {}), ...(options.textCase ? { textCase: options.textCase } : {}) };
    return this.add(id, options.component ?? 'Text', props, { item: { width: Sizing.Hug, height: Sizing.Hug }, ...options });
  }

  image(id: string, assetId: string, options: Common & { fit?: 'cover' | 'contain' }): string {
    return this.add(id, 'Image', { assetId, fit: options.fit ?? 'cover' }, options);
  }

  vector(id: string, path: string, options: Common & { fill: string }): string {
    return this.add(id, 'Shape', { shape: 'path', path, fills: [{ type: 'solid', color: options.fill, opacity: 1, visible: true, blend: 'normal' }], strokes: [] }, options);
  }

  instance(id: string, compId: string, options: Common & { overrides?: Record<string, Record<string, unknown>> }): string {
    const at = options.box ?? ZERO_BOX;
    const offset = { x: at.left / this.width, y: at.top / this.height };
    return this.add(id, 'Precomp', { comp: compId, ...(options.overrides ? { overrides: options.overrides } : {}) }, options, { transform: offset });
  }

  component(compId: string, name: string, draw: (kit: DocKit) => void): string {
    const inner = new DocKit(this.width, this.height);
    draw(inner);
    inner.families.forEach((f) => this.families.add(f));
    this.comps[compId] = { name, component: { name }, durationInFrames: FRAMES, tracks: inner.tracks() };
    Object.assign(this.comps, inner.comps);
    return compId;
  }

  tracks(): MotionTrack[] {
    return [{ id: 'v1', kind: TrackKind.Visual, name: 'Layers', clips: this.clips }];
  }

  doc(): MotionDoc {
    return {
      version: DOC_VERSION,
      fps: FPS,
      width: this.width,
      height: this.height,
      durationInFrames: FRAMES,
      tracks: this.tracks(),
      comps: this.comps,
      assets: [],
      camera: null,
      look: null,
      fonts: [...this.families].sort().map((family) => ({ family, source: 'google', category: 'sans', weights: GOOGLE_WEIGHTS, italic: false, axes: [] })),
      background: Background.Transparent,
      motionBlur: DEFAULT_MOTION_BLUR,
      fields: [],
      components: {},
      shaders: {},
      still: { frame: 0 }
    } as MotionDoc;
  }
}

export const box = (left: number, top: number, width: number, height: number): Px => ({ left, top, width, height });
