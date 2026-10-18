import type { ComponentId } from '../components';

export enum PaintKind {
  Fill = 'fill',
  Shape = 'shape',
  Image = 'image',
  Video = 'video',
  Logo = 'logo',
  Text = 'text',
  Particles = 'particles',
  Canvas = 'canvas',
  Html = 'html'
}

export enum Support {
  Native = 'native',
  Structural = 'structural',
  TextRaster = 'text-raster',
  HtmlTexture = 'html-texture'
}

export const SUPPORT: Record<ComponentId, Support> = {
  Title: Support.TextRaster,
  Text: Support.TextRaster,
  Kicker: Support.TextRaster,
  Caption: Support.TextRaster,
  Image: Support.Native,
  Video: Support.Native,
  Audio: Support.Structural,
  Shape: Support.Native,
  Logo: Support.Native,
  Null: Support.Structural,
  BrandBackground: Support.Native,
  ProductCard: Support.HtmlTexture,
  SocialMockup: Support.HtmlTexture,
  CanvasMock: Support.HtmlTexture,
  Model3D: Support.Native,
  Shape3D: Support.Native,
  Text3D: Support.Native,
  Logo3D: Support.Native,
  Device3D: Support.HtmlTexture,
  Composition: Support.HtmlTexture,
  Particles: Support.Native,
  LiquidGlass: Support.HtmlTexture,
  LiquidBlob: Support.HtmlTexture,
  ShaderEffect: Support.HtmlTexture,
  Precomp: Support.Structural,
  Adjustment: Support.HtmlTexture,
  Custom: Support.HtmlTexture
};

export const NATIVE_PAINT: Partial<Record<ComponentId, PaintKind>> = {
  BrandBackground: PaintKind.Fill,
  Shape: PaintKind.Shape,
  Image: PaintKind.Image,
  Video: PaintKind.Video,
  Logo: PaintKind.Logo,
  Particles: PaintKind.Particles
};

export const isNative = (component: string) => SUPPORT[component as ComponentId] === Support.Native;
