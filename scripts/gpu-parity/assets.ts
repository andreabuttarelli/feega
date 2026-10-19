import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const ASSET_SIZE = { width: 1600, height: 1000 };

export const VIDEO_ASSET = /^video/;

export function placeholderVideo(): Buffer {
  return execFileSync('ffmpeg', ['-loglevel', 'error', '-f', 'lavfi', '-i', `testsrc2=size=${ASSET_SIZE.width}x${ASSET_SIZE.height}:rate=30:duration=4`, '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-g', '1', '-movflags', 'frag_keyframe+empty_moov', '-f', 'mp4', 'pipe:1'], { maxBuffer: 1 << 28 });
}

export const assetPath = (id: string) => (VIDEO_ASSET.test(id) ? `/assets/${id}.mp4` : `/assets/${id}.png`);

export async function placeholder(id: string): Promise<Buffer> {
  const hue = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ASSET_SIZE.width}" height="${ASSET_SIZE.height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,55%)"/><stop offset="1" stop-color="hsl(${(hue + 120) % 360},60%,25%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="520" cy="420" r="260" fill="hsl(${(hue + 60) % 360},80%,70%)" opacity="0.8"/><rect x="900" y="560" width="520" height="300" fill="#fff" opacity="0.85"/><path d="M0 1000 L800 600 L1600 1000Z" fill="#111" opacity="0.5"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
