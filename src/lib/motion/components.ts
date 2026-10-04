import { z } from 'zod';
import { BuiltinFont, FONT_NAME } from './fonts/model';
import { DURATION, EASE_IDS, Ease, FPS } from './design';
import { MATERIALS, Material } from './materials';
import { DEVICES, Device, FINISHES, Finish } from './devices';
import { LAYOUTS } from '../canvas/composition/index';
import { CAMERA_PRESETS } from '../canvas/composition/camera';
import type { CameraPresetId } from '../canvas/composition/camera';
import type { LayoutId } from '../canvas/composition/types';
import { EMITTERS, Emitter, PARTICLE_COLOURS, PARTICLE_COLOUR_KEYS, PARTICLE_NUMBERS, PARTICLE_NUMBER_KEYS, PARTICLE_SHAPES, ParticleSection, ParticleShape, SEED } from './particles/model';
import { CAPS, FILL_KINDS, FILL_RULES, FillKind, JOINS, MAX_MODIFIERS, MAX_MORPHS, SHAPE_KINDS, STROKE_KINDS, ShapeKind, StrokeKind, modifierSchema, pathString } from './shape/schema';

export enum Control {
  Text = 'text',
  Textarea = 'textarea',
  Range = 'range',
  Color = 'color',
  Select = 'select',
  Toggle = 'toggle',
  Asset = 'asset',
  Managed = 'managed',
  Font = 'font'
}

export enum AssetKind {
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
  Model3d = 'model3d',
  Font = 'font'
}

export enum Group {
  Content = 'Content',
  Style = 'Style',
  Layout = 'Layout',
  Motion = 'Motion',
  Camera = 'Camera'
}

export const BRAND_COLORS = ['brand.primary', 'brand.secondary', 'brand.accent', 'brand.background', 'brand.text'] as const;
export type BrandColor = (typeof BRAND_COLORS)[number];

export const CUSTOM_NAME = /^[A-Z][A-Za-z0-9]{1,39}$/;

export const COLOR = /^(#[0-9a-fA-F]{6}|brand\.(primary|secondary|accent|background|text)|transparent)$/;

const color = (fallback: string, label: string) =>
  z.string().regex(COLOR, 'expected #rrggbb, transparent or a brand colour').default(fallback).meta({ control: Control.Color, label, group: Group.Style });

const range = (min: number, max: number, step: number, fallback: number, label: string, group: Group) =>
  z.number().min(min).max(max).default(fallback).meta({ control: Control.Range, step, label, group });

const choice = <T extends readonly [string, ...string[]]>(values: T, fallback: T[number], label: string, group: Group) =>
  z.enum(values).default(fallback as never).meta({ control: Control.Select, label, group });

const text = (fallback: string, label: string, multiline = false) =>
  z.string().max(500).default(fallback).meta({ control: multiline ? Control.Textarea : Control.Text, label, group: Group.Content });

const asset = (kind: AssetKind, label: string) =>
  z.string().nullable().default(null).meta({ control: Control.Asset, assetKind: kind, label, group: Group.Content });

const fade = (label: string) => range(0, 5, 0.1, 0, label, Group.Style);

const toggle = (fallback: boolean, label: string, group: Group) =>
  z.boolean().default(fallback).meta({ control: Control.Toggle, label, group });

export const FONTS = [BuiltinFont.Sans, BuiltinFont.Mono] as const;
const REGULAR = 400;
const MEDIUM = 500;
export const ALIGNS = ['left', 'center', 'right'] as const;
export const MOVES = ['none', 'drift-up', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right'] as const;
export type Move = (typeof MOVES)[number];

const layout = (box: { x?: number; y?: number; width?: number; height?: number } = {}) => ({
  x: range(0, 1, 0.01, box.x ?? 0.5, 'X', Group.Layout),
  y: range(0, 1, 0.01, box.y ?? 0.5, 'Y', Group.Layout),
  width: range(0.02, 1, 0.01, box.width ?? 0.8, 'Width', Group.Layout),
  height: range(0.002, 1, 0.001, box.height ?? 0.5, 'Height', Group.Layout),
  align: choice(ALIGNS, 'center', 'Align', Group.Layout),
  opacity: range(0, 1, 0.01, 1, 'Opacity', Group.Layout),
  scale: range(0.1, 4, 0.01, 1, 'Scale', Group.Layout),
  rotation: range(-180, 180, 1, 0, 'Rotation', Group.Layout),
  move: choice(MOVES, 'none', 'Move', Group.Motion),
  easing: choice(EASE_IDS, Ease.Standard, 'Easing', Group.Motion)
});

const font = () => z.string().regex(FONT_NAME, 'expected a font family name').default(BuiltinFont.Sans).meta({ control: Control.Font, label: 'Font', group: Group.Style });

export const TYPE = {
  tracking: { min: -0.2, max: 1, step: 0.005 },
  leading: { min: 0.6, max: 3, step: 0.01 },
  weight: { min: 100, max: 1000, step: 1 },
  stretch: { min: 25, max: 200, step: 1, fallback: 100 },
  slant: { min: -20, max: 20, step: 0.5, fallback: 0 }
} as const;

export const AXES = /^('[A-Za-z0-9]{4}' -?\d+(\.\d+)?)(, '[A-Za-z0-9]{4}' -?\d+(\.\d+)?)*$|^$/;

type Look = { weight?: number; tracking: number; leading: number };

const typography = (size: number, fallbackColor: string, look: Look) => ({
  color: color(fallbackColor, 'Colour'),
  font: font(),
  weight: range(TYPE.weight.min, TYPE.weight.max, TYPE.weight.step, look.weight ?? REGULAR, 'Weight', Group.Style),
  italic: toggle(false, 'Italic', Group.Style),
  size: range(0.01, 0.4, 0.005, size, 'Size', Group.Style),
  tracking: range(TYPE.tracking.min, TYPE.tracking.max, TYPE.tracking.step, look.tracking, 'Tracking', Group.Style),
  leading: range(TYPE.leading.min, TYPE.leading.max, TYPE.leading.step, look.leading, 'Leading', Group.Style),
  stretch: range(TYPE.stretch.min, TYPE.stretch.max, TYPE.stretch.step, TYPE.stretch.fallback, 'Width axis', Group.Style),
  slant: range(TYPE.slant.min, TYPE.slant.max, TYPE.slant.step, TYPE.slant.fallback, 'Slant axis', Group.Style),
  axes: z.string().max(200).regex(AXES, "axes look like 'GRAD' 50, 'CASL' 1").default('').meta({ control: Control.Text, label: 'Other axes', group: Group.Style })
});

export const LIGHTINGS = ['studio', 'soft', 'dramatic'] as const;
export const BACKDROPS = ['transparent', 'brand', 'dark', 'light'] as const;
export const SHAPES_3D = ['cube', 'sphere', 'torus', 'cone'] as const;
export const SHAPES_2D = SHAPE_KINDS;

const camera = {
  startAngle: range(-360, 360, 1, -20, 'Start angle', Group.Camera),
  endAngle: range(-360, 360, 1, 40, 'End angle', Group.Camera),
  orbitSpeed: range(0, 180, 1, 0, 'Turntable °/s', Group.Camera),
  zoom: range(0.3, 3, 0.01, 1, 'Zoom', Group.Camera),
  lighting: choice(LIGHTINGS, 'studio', 'Lighting', Group.Camera),
  backdrop: choice(BACKDROPS, 'transparent', 'Background', Group.Camera),
  shadow: toggle(true, 'Shadow', Group.Camera),
  easing: choice(EASE_IDS, Ease.Standard, 'Easing', Group.Motion)
};

const surface = { material: choice(MATERIALS, Material.Original, 'Material', Group.Style) };

const extrusion = {
  extrude: range(0.02, 1.5, 0.01, 0.35, 'Depth', Group.Style),
  bevel: range(0, 0.2, 0.005, 0.03, 'Bevel', Group.Style)
};

const position3d = {
  x: range(0, 1, 0.01, 0.5, 'X', Group.Layout),
  y: range(0, 1, 0.01, 0.5, 'Y', Group.Layout),
  width: range(0.1, 1, 0.01, 1, 'Width', Group.Layout),
  height: range(0.1, 1, 0.01, 1, 'Height', Group.Layout)
};

export const COMPOSITION_LAYOUTS = Object.keys(LAYOUTS) as [LayoutId, ...LayoutId[]];
export const COMPOSITION_CAMERAS = Object.keys(CAMERA_PRESETS) as [CameraPresetId, ...CameraPresetId[]];
export const COMPOSITION_MEDIA_KINDS = ['image', 'video'] as const;
export const MAX_COMPOSITION_MEDIA = 40;

const managed = (label: string) => ({ control: Control.Managed, label, group: Group.Content });
const compositionParams = (label: string) => z.record(z.string(), z.union([z.number(), z.string()])).default({}).meta(managed(label));

export enum TrackKind {
  Visual = 'visual',
  Audio = 'audio'
}

type Spec = {
  label: string;
  description: string;
  track: TrackKind;
  durationInFrames: number;
  schema: z.ZodObject;
};

const seconds = (n: number) => n * FPS;

const PARTICLE_GROUP: Record<ParticleSection, Group> = {
  [ParticleSection.Emitter]: Group.Layout,
  [ParticleSection.Motion]: Group.Motion,
  [ParticleSection.Look]: Group.Style
};

const particleNumbers = Object.fromEntries(
  PARTICLE_NUMBER_KEYS.map((key) => {
    const p = PARTICLE_NUMBERS[key];
    return [key, range(p.min, p.max, p.step, p.fallback, p.label, PARTICLE_GROUP[p.section])];
  })
);

const particleColours = Object.fromEntries(PARTICLE_COLOUR_KEYS.map((key) => [key, color(PARTICLE_COLOURS[key].fallback, PARTICLE_COLOURS[key].label)]));

export const COMPONENTS = {
  Title: {
    label: 'Title',
    description: 'Large headline, lines reveal one after another. Use \\n for line breaks.',
    track: TrackKind.Visual,
    durationInFrames: seconds(3),
    schema: z.object({ text: text('Better marketing\non canvas.', 'Text', true), ...typography(0.11, 'brand.text', { weight: MEDIUM, tracking: -0.045, leading: 0.95 }), ...layout({ height: 0.4 }) }).strict()
  },
  Text: {
    label: 'Text',
    description: 'Body copy that fades up.',
    track: TrackKind.Visual,
    durationInFrames: seconds(3),
    schema: z.object({ text: text('Write something.', 'Text', true), ...typography(0.04, 'brand.text', { tracking: -0.01, leading: 1.3 }), ...layout({ y: 0.65, height: 0.2 }) }).strict()
  },
  Kicker: {
    label: 'Kicker',
    description: 'Small monospaced uppercase label above a title.',
    track: TrackKind.Visual,
    durationInFrames: seconds(3),
    schema: z.object({ text: text('( feega )', 'Text'), ...typography(0.025, 'brand.accent', { tracking: 0.02, leading: 1.2 }), ...layout({ y: 0.3, height: 0.06 }) }).strict()
  },
  Caption: {
    label: 'Caption',
    description: 'Subtitle box near the bottom.',
    track: TrackKind.Visual,
    durationInFrames: seconds(2),
    schema: z
      .object({ text: text('A caption', 'Text'), ...typography(0.035, '#ffffff', { weight: MEDIUM, tracking: 0, leading: 1.25 }), background: color('#111111', 'Box'), ...layout({ y: 0.85, height: 0.1 }) })
      .strict()
  },
  Image: {
    label: 'Image',
    description: 'A picture from the canvas assets.',
    track: TrackKind.Visual,
    durationInFrames: seconds(3),
    schema: z.object({ assetId: asset(AssetKind.Image, 'Image'), fit: choice(['cover', 'contain'] as const, 'cover', 'Fit', Group.Style), ...layout({ width: 1, height: 1 }) }).strict()
  },
  Video: {
    label: 'Video',
    description: 'A video clip from the canvas assets. speed plays it faster or slower, reverse backwards; keyframes on time (source seconds) remap it freely, one keyframe freezes it. A remapped video is silent.',
    track: TrackKind.Visual,
    durationInFrames: seconds(4),
    schema: z
      .object({
        assetId: asset(AssetKind.Video, 'Video'),
        fit: choice(['cover', 'contain'] as const, 'cover', 'Fit', Group.Style),
        volume: range(0, 1, 0.01, 0, 'Volume', Group.Style),
        fadeIn: fade('Fade in (s)'),
        fadeOut: fade('Fade out (s)'),
        speed: range(0.1, 10, 0.01, 1, 'Speed', Group.Motion),
        reverse: toggle(false, 'Reverse', Group.Motion),
        ...layout({ width: 1, height: 1 })
      })
      .strict()
  },
  Audio: {
    label: 'Audio',
    description: 'Music or voice-over from the canvas assets.',
    track: TrackKind.Audio,
    durationInFrames: seconds(5),
    schema: z.object({ assetId: asset(AssetKind.Audio, 'Audio'), volume: range(0, 1, 0.01, 1, 'Volume', Group.Style), fadeIn: fade('Fade in (s)'), fadeOut: fade('Fade out (s)') }).strict()
  },
  Shape: {
    label: 'Shape',
    description: 'Vector shape: rectangle, ellipse, polygon, star or a free path, with gradient fill, stroke, morph and modifiers.',
    track: TrackKind.Visual,
    durationInFrames: seconds(3),
    schema: z
      .object({
        shape: choice(SHAPES_2D, ShapeKind.Line, 'Shape', Group.Content),
        path: pathString.default('').meta(managed('Path')),
        roundness: range(0, 0.5, 0.01, 0, 'Roundness', Group.Content),
        sides: range(3, 64, 1, 6, 'Sides', Group.Content),
        points: range(3, 64, 1, 5, 'Points', Group.Content),
        innerRadius: range(0.05, 1, 0.01, 0.5, 'Inner radius', Group.Content),
        morphs: z.array(pathString).max(MAX_MORPHS).default([]).meta(managed('Morph targets')),
        morph: range(0, MAX_MORPHS, 0.01, 0, 'Morph', Group.Content),
        morphStart: range(0, 1, 0.01, 0, 'Morph start point', Group.Content),
        modifiers: z.array(modifierSchema).max(MAX_MODIFIERS).default([]).meta(managed('Modifiers')),
        fillKind: choice(FILL_KINDS, FillKind.Solid, 'Fill type', Group.Style),
        fill: color('brand.accent', 'Fill'),
        fill2: color('brand.primary', 'Gradient end'),
        gradientAngle: range(-360, 360, 1, 90, 'Gradient angle', Group.Style),
        fillRule: choice(FILL_RULES, 'nonzero', 'Fill rule', Group.Style),
        strokeKind: choice(STROKE_KINDS, StrokeKind.None, 'Stroke', Group.Style),
        stroke: color('brand.text', 'Stroke colour'),
        strokeWidth: range(0, 0.2, 0.001, 0.01, 'Stroke width', Group.Style),
        dash: range(0, 0.5, 0.001, 0, 'Dash', Group.Style),
        gap: range(0, 0.5, 0.001, 0, 'Gap', Group.Style),
        cap: choice(CAPS, 'butt', 'Cap', Group.Style),
        join: choice(JOINS, 'miter', 'Join', Group.Style),
        ...layout({ y: 0.6, height: 0.004 })
      })
      .strict()
  },
  Logo: {
    label: 'Logo',
    description: 'The brand logo, or any picture used as a logo.',
    track: TrackKind.Visual,
    durationInFrames: seconds(3),
    schema: z.object({ assetId: asset(AssetKind.Image, 'Logo (empty = brand logo)'), ...layout({ width: 0.2, height: 0.2 }) }).strict()
  },
  Null: {
    label: 'Null',
    description: 'Invisible handle, draws nothing: parent clips to it and animate it to move, turn or scale them together. x/y is its pivot.',
    track: TrackKind.Visual,
    durationInFrames: seconds(5),
    schema: z.object({ x: range(0, 1, 0.01, 0.5, 'Pivot X', Group.Layout), y: range(0, 1, 0.01, 0.5, 'Pivot Y', Group.Layout) }).strict()
  },
  BrandBackground: {
    label: 'Background',
    description: 'Full-frame background in the brand colours.',
    track: TrackKind.Visual,
    durationInFrames: seconds(5),
    schema: z
      .object({
        fill: color('brand.background', 'Fill'),
        pattern: choice(['solid', 'dots', 'grid', 'gradient'] as const, 'solid', 'Pattern', Group.Style),
        accent: color('brand.accent', 'Accent'),
        opacity: range(0, 1, 0.01, 1, 'Opacity', Group.Layout)
      })
      .strict()
  },
  ProductCard: {
    label: 'Product card',
    description: 'Product picture with name and price.',
    track: TrackKind.Visual,
    durationInFrames: seconds(3),
    schema: z
      .object({
        assetId: asset(AssetKind.Image, 'Product image'),
        title: text('Linen tee', 'Name'),
        price: text('€ 39', 'Price'),
        ...typography(0.035, '#111111', { tracking: 0, leading: 1.2 }),
        card: color('#ffffff', 'Card'),
        ...layout({ width: 0.5, height: 0.6 })
      })
      .strict()
  },
  SocialMockup: {
    label: 'Social post',
    description: 'A picture framed as a social post with handle and caption.',
    track: TrackKind.Visual,
    durationInFrames: seconds(3),
    schema: z
      .object({
        assetId: asset(AssetKind.Image, 'Image'),
        handle: text('@brand', 'Handle'),
        caption: text('New drop, out now.', 'Caption'),
        platform: choice(['instagram', 'tiktok'] as const, 'instagram', 'Platform', Group.Style),
        ...layout({ width: 0.5, height: 0.75 })
      })
      .strict()
  },
  CanvasMock: {
    label: 'Canvas mock',
    description: 'A feega canvas with a prompt node feeding an image node.',
    track: TrackKind.Visual,
    durationInFrames: seconds(4),
    schema: z
      .object({
        title: text('Spring drop', 'Board name'),
        prompt: text('Cream linen tee on a concrete plinth, soft studio light.', 'Prompt', true),
        assetId: asset(AssetKind.Image, 'Result image'),
        ...layout({ width: 0.9, height: 0.8 })
      })
      .strict()
  },
  Model3D: {
    label: '3D model',
    description: 'A GLB model from the canvas, turned by an orbiting camera between a start and an end angle.',
    track: TrackKind.Visual,
    durationInFrames: seconds(4),
    schema: z.object({ assetId: asset(AssetKind.Model3d, '3D model'), ...surface, ...camera, ...position3d }).strict()
  },
  Shape3D: {
    label: '3D shape',
    description: 'A lit 3D primitive turning on itself.',
    track: TrackKind.Visual,
    durationInFrames: seconds(3),
    schema: z
      .object({ shape: choice(SHAPES_3D, 'torus', 'Shape', Group.Content), fill: color('brand.accent', 'Colour'), ...surface, ...camera, ...position3d })
      .strict()
  },
  Text3D: {
    label: '3D text',
    description: 'Extruded 3D lettering in any Google or uploaded font, with depth, bevel and a material, lit by the look of the video.',
    track: TrackKind.Visual,
    durationInFrames: seconds(3),
    schema: z
      .object({ text: text('Hello', 'Text'), font: font(), weight: range(100, 900, 100, 700, 'Weight', Group.Style), fill: color('brand.accent', 'Colour'), ...extrusion, material: choice(MATERIALS, Material.Plastic, 'Material', Group.Style), ...camera, ...position3d })
      .strict()
  },
  Logo3D: {
    label: '3D logo',
    description: 'An SVG logo extruded into a solid with depth, bevel and a material; without an asset it uses the brand logo when that is an SVG.',
    track: TrackKind.Visual,
    durationInFrames: seconds(3),
    schema: z
      .object({ assetId: asset(AssetKind.Image, 'SVG logo'), fill: color('brand.primary', 'Colour'), ...extrusion, material: choice(MATERIALS, Material.Metal, 'Material', Group.Style), ...camera, ...position3d })
      .strict()
  },
  Device3D: {
    label: 'Device mockup',
    description: 'A 3D phone, laptop, monitor, tablet or browser window with an image or video mapped on its screen, lit by the look of the video. Animate lid (laptops, degrees open) and screenScroll (0..1, scrolls a tall screenshot); apply_device_preset adds spin-in, hero turn, lid opening or screen scroll.',
    track: TrackKind.Visual,
    durationInFrames: seconds(4),
    schema: z
      .object({
        device: choice(DEVICES, Device.PhonePro, 'Device', Group.Content),
        screen: asset(AssetKind.Image, 'Screen image'),
        screenVideo: asset(AssetKind.Video, 'Screen video'),
        finish: choice(FINISHES, Finish.Default, 'Finish', Group.Style),
        ...camera,
        ...position3d
      })
      .strict()
  },
  Composition: {
    label: 'Composition',
    description: 'Many images or videos arranged in 3D (grid, carousel, helix, coverflow…) and looping every `loop` seconds.',
    track: TrackKind.Visual,
    durationInFrames: seconds(6),
    schema: z
      .object({
        layout: choice(COMPOSITION_LAYOUTS, 'tilted-grid', 'Template', Group.Content),
        media: z
          .array(z.object({ assetId: z.string().min(1), kind: z.enum(COMPOSITION_MEDIA_KINDS) }).strict())
          .max(MAX_COMPOSITION_MEDIA)
          .default([])
          .meta(managed('Media')),
        layoutParams: compositionParams('Template settings'),
        camera: choice(COMPOSITION_CAMERAS, 'slow-orbit', 'Camera', Group.Camera),
        cameraParams: compositionParams('Camera settings'),
        background: color('#000000', 'Background'),
        loop: range(0.5, 60, 0.5, 6, 'Loop (s)', Group.Motion)
      })
      .strict()
  },
  Particles: {
    label: 'Particles',
    description: 'A seeded particle emitter (sparks, dust, confetti, bokeh, snow…): every frame is computed from the seed and the time, so seeking and rendering always agree. Sizes and speeds are fractions of the short side of the frame per second; direction in degrees (-90 = up), gravity pulls down.',
    track: TrackKind.Visual,
    durationInFrames: seconds(4),
    schema: z
      .object({
        seed: range(SEED.min, SEED.max, 1, SEED.fallback, 'Seed', Group.Content),
        emitter: choice(EMITTERS, Emitter.Point, 'Emitter', Group.Content),
        shape: choice(PARTICLE_SHAPES, ParticleShape.Circle, 'Shape', Group.Content),
        sprite: asset(AssetKind.Image, 'Sprite (shape: sprite)'),
        prewarm: toggle(false, 'Prewarm', Group.Motion),
        ...particleNumbers,
        ...particleColours
      })
      .strict()
  },
  Custom: {
    label: 'Custom',
    description: 'A component written in code for this video (write_component); its props come from its own props schema.',
    track: TrackKind.Visual,
    durationInFrames: seconds(4),
    schema: z.object({ name: z.string().regex(CUSTOM_NAME, 'a custom component name, e.g. NodeGraph') }).catchall(z.unknown())
  }
} satisfies Record<string, Spec>;

export type ComponentId = keyof typeof COMPONENTS;

export const COMPONENT_IDS = Object.keys(COMPONENTS) as [ComponentId, ...ComponentId[]];

export const THREE_D_COMPONENTS: readonly ComponentId[] = ['Model3D', 'Shape3D', 'Text3D', 'Logo3D', 'Device3D'];

export const CODE_COMPONENTS: readonly ComponentId[] = ['Custom'];

export const LIBRARY_IDS = COMPONENT_IDS.filter((id) => !CODE_COMPONENTS.includes(id));

export function isComponentId(x: string): x is ComponentId {
  return (COMPONENT_IDS as readonly string[]).includes(x);
}

export function defaultProps(id: ComponentId): Record<string, unknown> {
  return (COMPONENTS[id].schema.safeParse({}).data ?? {}) as Record<string, unknown>;
}

export type PropsVerdict = { ok: true; props: Record<string, unknown> } | { ok: false; error: string };

export function parseProps(id: ComponentId, props: unknown): PropsVerdict {
  const parsed = COMPONENTS[id].schema.safeParse(props ?? {});
  if (!parsed.success) {
    return { ok: false, error: `${id}: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}` };
  }
  return { ok: true, props: parsed.data as Record<string, unknown> };
}

export const TRANSITION_DEFAULT = DURATION.base;
