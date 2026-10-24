import sharp from 'sharp';
import type { Mask, Region, Stroke } from '$lib/image-mask';

export type PixelSize = { width: number; height: number };

const WHITE = '#fff';
const BLACK = '#000';
const THRESHOLD = 128;
const SHAPE = 'shape-rendering="crispEdges"';

function strokeSvg(stroke: Stroke, size: PixelSize): string {
  const brush = stroke.width * Math.min(size.width, size.height);
  const points = stroke.points.map(([x, y]) => [x * size.width, y * size.height] as const);
  if (points.length === 1) {
    return `<circle cx="${points[0][0]}" cy="${points[0][1]}" r="${brush / 2}" fill="${WHITE}" ${SHAPE}/>`;
  }
  const path = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
  return `<path d="${path}" fill="none" stroke="${WHITE}" stroke-width="${brush}" stroke-linecap="round" stroke-linejoin="round" ${SHAPE}/>`;
}

function regionSvg(region: Region, size: PixelSize): string {
  return `<rect x="${region.left * size.width}" y="${region.top * size.height}" width="${region.width * size.width}" height="${region.height * size.height}" fill="${WHITE}" ${SHAPE}/>`;
}

export async function maskPng(size: PixelSize, mask: Partial<Mask>): Promise<Buffer> {
  const marks = [...(mask.regions ?? []).map((region) => regionSvg(region, size)), ...(mask.strokes ?? []).map((stroke) => strokeSvg(stroke, size))];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}"><rect width="100%" height="100%" fill="${BLACK}"/>${marks.join('')}</svg>`;
  return sharp(Buffer.from(svg)).greyscale().threshold(THRESHOLD).toColourspace('srgb').png().toBuffer();
}
