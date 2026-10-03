import { z } from 'zod';
import { DURATION, EASE_IDS, Ease, FPS } from './design';

export enum Control {
  Text = 'text',
  Textarea = 'textarea',
  Range = 'range',
  Color = 'color',
  Select = 'select',
  Toggle = 'toggle',
  Asset = 'asset'
}

export enum AssetKind {
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
  Model3d = 'model3d'
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

const COLOR = /^(#[0-9a-fA-F]{6}|brand\.(primary|secondary|accent|background|text)|transparent)$/;

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

const toggle = (fallback: boolean, label: string, group: Group) =>
  z.boolean().default(fallback).meta({ control: Control.Toggle, label, group });

export const FONTS = ['sans', 'mono'] as const;
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

const typography = (size: number, fallbackColor: string) => ({
  color: color(fallbackColor, 'Colour'),
  font: choice(FONTS, 'sans', 'Font', Group.Style),
  size: range(0.01, 0.4, 0.005, size, 'Size', Group.Style)
});

export const LIGHTINGS = ['studio', 'soft', 'dramatic'] as const;
export const BACKDROPS = ['transparent', 'brand', 'dark', 'light'] as const;
export const SHAPES_3D = ['cube', 'sphere', 'torus', 'cone'] as const;
export const SHAPES_2D = ['rect', 'circle', 'line'] as const;

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

const position3d = {
  x: range(0, 1, 0.01, 0.5, 'X', Group.Layout),
  y: range(0, 1, 0.01, 0.5, 'Y', Group.Layout),
  width: range(0.1, 1, 0.01, 1, 'Width', Group.Layout),
  height: range(0.1, 1, 0.01, 1, 'Height', Group.Layout)
};

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

export const COMPONENTS = {
  Title: {
    label: 'Title',
    description: 'Large headline, lines reveal one after another. Use \\n for line breaks.',
    track: TrackKind.Visual,
    durationInFrames: seconds(3),
    schema: z.object({ text: text('Better marketing\non canvas.', 'Text', true), ...typography(0.11, 'brand.text'), ...layout({ height: 0.4 }) }).strict()
  },
  Text: {
    label: 'Text',
    description: 'Body copy that fades up.',
    track: TrackKind.Visual,
    durationInFrames: seconds(3),
    schema: z.object({ text: text('Write something.', 'Text', true), ...typography(0.04, 'brand.text'), ...layout({ y: 0.65, height: 0.2 }) }).strict()
  },
  Kicker: {
    label: 'Kicker',
    description: 'Small monospaced uppercase label above a title.',
    track: TrackKind.Visual,
    durationInFrames: seconds(3),
    schema: z.object({ text: text('( feega )', 'Text'), ...typography(0.025, 'brand.accent'), ...layout({ y: 0.3, height: 0.06 }) }).strict()
  },
  Caption: {
    label: 'Caption',
    description: 'Subtitle box near the bottom.',
    track: TrackKind.Visual,
    durationInFrames: seconds(2),
    schema: z
      .object({ text: text('A caption', 'Text'), ...typography(0.035, '#ffffff'), background: color('#111111', 'Box'), ...layout({ y: 0.85, height: 0.1 }) })
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
    description: 'A video clip from the canvas assets.',
    track: TrackKind.Visual,
    durationInFrames: seconds(4),
    schema: z
      .object({
        assetId: asset(AssetKind.Video, 'Video'),
        fit: choice(['cover', 'contain'] as const, 'cover', 'Fit', Group.Style),
        volume: range(0, 1, 0.01, 0, 'Volume', Group.Style),
        ...layout({ width: 1, height: 1 })
      })
      .strict()
  },
  Audio: {
    label: 'Audio',
    description: 'Music or voice-over from the canvas assets.',
    track: TrackKind.Audio,
    durationInFrames: seconds(5),
    schema: z.object({ assetId: asset(AssetKind.Audio, 'Audio'), volume: range(0, 1, 0.01, 1, 'Volume', Group.Style) }).strict()
  },
  Shape: {
    label: 'Shape',
    description: 'Rectangle, circle or line.',
    track: TrackKind.Visual,
    durationInFrames: seconds(3),
    schema: z.object({ shape: choice(SHAPES_2D, 'line', 'Shape', Group.Content), fill: color('brand.accent', 'Fill'), ...layout({ y: 0.6, height: 0.004 }) }).strict()
  },
  Logo: {
    label: 'Logo',
    description: 'The brand logo, or any picture used as a logo.',
    track: TrackKind.Visual,
    durationInFrames: seconds(3),
    schema: z.object({ assetId: asset(AssetKind.Image, 'Logo (empty = brand logo)'), ...layout({ width: 0.2, height: 0.2 }) }).strict()
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
        ...typography(0.035, '#111111'),
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
    schema: z.object({ assetId: asset(AssetKind.Model3d, '3D model'), ...camera, ...position3d }).strict()
  },
  Shape3D: {
    label: '3D shape',
    description: 'A lit 3D primitive turning on itself.',
    track: TrackKind.Visual,
    durationInFrames: seconds(3),
    schema: z
      .object({ shape: choice(SHAPES_3D, 'torus', 'Shape', Group.Content), fill: color('brand.accent', 'Colour'), ...camera, ...position3d })
      .strict()
  }
} satisfies Record<string, Spec>;

export type ComponentId = keyof typeof COMPONENTS;

export const COMPONENT_IDS = Object.keys(COMPONENTS) as [ComponentId, ...ComponentId[]];

export const THREE_D_COMPONENTS: readonly ComponentId[] = ['Model3D', 'Shape3D'];

export function isComponentId(x: string): x is ComponentId {
  return (COMPONENT_IDS as readonly string[]).includes(x);
}

export function defaultProps(id: ComponentId): Record<string, unknown> {
  return COMPONENTS[id].schema.parse({}) as Record<string, unknown>;
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
