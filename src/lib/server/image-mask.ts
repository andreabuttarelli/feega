import sharp from 'sharp';
import { MaskPaint } from '$lib/image-tools';
import type { Mask, Region, Stroke } from '$lib/image-mask';

export type PixelSize = { width: number; height: number };

const COLOUR: Readonly<Record<MaskPaint, string>> = { [MaskPaint.White]: '#fff', [MaskPaint.Black]: '#000' };
const OPPOSITE: Readonly<Record<MaskPaint, MaskPaint>> = { [MaskPaint.White]: MaskPaint.Black, [MaskPaint.Black]: MaskPaint.White };
const THRESHOLD = 128;
const SHAPE = 'shape-rendering="crispEdges"';

function strokeSvg(stroke: Stroke, size: PixelSize, ink: string): string {
  const brush = stroke.width * Math.min(size.width, size.height);
  const points = stroke.points.map(([x, y]) => [x * size.width, y * size.height] as const);
  if (points.length === 1) {
    return `<circle cx="${points[0][0]}" cy="${points[0][1]}" r="${brush / 2}" fill="${ink}" ${SHAPE}/>`;
  }
  const path = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
  return `<path d="${path}" fill="none" stroke="${ink}" stroke-width="${brush}" stroke-linecap="round" stroke-linejoin="round" ${SHAPE}/>`;
}

function regionSvg(region: Region, size: PixelSize, ink: string): string {
  return `<rect x="${region.left * size.width}" y="${region.top * size.height}" width="${region.width * size.width}" height="${region.height * size.height}" fill="${ink}" ${SHAPE}/>`;
}

export async function maskPng(size: PixelSize, mask: Partial<Mask>, paint: MaskPaint): Promise<Buffer> {
  const ink = COLOUR[paint];
  const ground = COLOUR[OPPOSITE[paint]];
  const marks = [...(mask.regions ?? []).map((region) => regionSvg(region, size, ink)), ...(mask.strokes ?? []).map((stroke) => strokeSvg(stroke, size, ink))];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}"><rect width="100%" height="100%" fill="${ground}"/>${marks.join('')}</svg>`;
  return sharp(Buffer.from(svg)).greyscale().threshold(THRESHOLD).toColourspace('srgb').png().toBuffer();
}
