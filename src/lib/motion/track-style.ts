import type { ComponentId } from './components';

export enum ClipFamily {
  Text = 'text',
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
  Shape = 'shape',
  ThreeD = '3d',
  Custom = 'custom',
  Null = 'null',
  Camera = 'camera',
  Mask = 'mask'
}

export enum Preview {
  Text = 'text',
  Thumb = 'thumb',
  Filmstrip = 'filmstrip',
  Waveform = 'waveform',
  Icon = 'icon'
}

export type FamilyStyle = { label: string; hue: string; preview: Preview };

export const CLIP_FAMILIES: Record<ClipFamily, FamilyStyle> = {
  [ClipFamily.Text]: { label: 'Text', hue: '#7c5cff', preview: Preview.Text },
  [ClipFamily.Image]: { label: 'Image', hue: '#12a594', preview: Preview.Thumb },
  [ClipFamily.Video]: { label: 'Video', hue: '#e5484d', preview: Preview.Filmstrip },
  [ClipFamily.Audio]: { label: 'Audio', hue: '#f5a524', preview: Preview.Waveform },
  [ClipFamily.Shape]: { label: 'Shape', hue: '#d6409f', preview: Preview.Icon },
  [ClipFamily.ThreeD]: { label: '3D', hue: '#f76b15', preview: Preview.Icon },
  [ClipFamily.Custom]: { label: 'Code', hue: '#46a758', preview: Preview.Icon },
  [ClipFamily.Null]: { label: 'Null', hue: '#8b8d98', preview: Preview.Icon },
  [ClipFamily.Camera]: { label: 'Camera', hue: '#00a2c7', preview: Preview.Icon },
  [ClipFamily.Mask]: { label: 'Mask', hue: '#978365', preview: Preview.Icon }
};

const COMPONENT_FAMILY: Record<ComponentId, ClipFamily> = {
  Title: ClipFamily.Text,
  Text: ClipFamily.Text,
  Kicker: ClipFamily.Text,
  Caption: ClipFamily.Text,
  Image: ClipFamily.Image,
  Logo: ClipFamily.Image,
  ProductCard: ClipFamily.Image,
  SocialMockup: ClipFamily.Image,
  CanvasMock: ClipFamily.Image,
  Video: ClipFamily.Video,
  Audio: ClipFamily.Audio,
  Shape: ClipFamily.Shape,
  BrandBackground: ClipFamily.Shape,
  Model3D: ClipFamily.ThreeD,
  Shape3D: ClipFamily.ThreeD,
  Text3D: ClipFamily.ThreeD,
  Logo3D: ClipFamily.ThreeD,
  Device3D: ClipFamily.ThreeD,
  Composition: ClipFamily.ThreeD,
  Null: ClipFamily.Null,
  Particles: ClipFamily.Shape,
  Custom: ClipFamily.Custom
};

export function familyOf(component: ComponentId): ClipFamily {
  return COMPONENT_FAMILY[component];
}

export type TileQuery = { samples: number; sourceSeconds: number; trimSeconds: number; clipSeconds: number; tiles: number };

export function tileFrames(q: TileQuery): number[] {
  if (q.samples < 1 || q.sourceSeconds <= 0) {
    return [];
  }

  return Array.from({ length: q.tiles }, (_, k) => {
    const at = q.trimSeconds + (k * q.clipSeconds) / q.tiles;
    return Math.min(q.samples - 1, Math.floor((at / q.sourceSeconds) * q.samples));
  });
}
