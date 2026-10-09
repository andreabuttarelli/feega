import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r181/examples/textures/equirectangular/';
const OUT = 'static/motion-env/r181';
const WIDTH = 256;
const FILES = ['pedestrian_overpass_1k.hdr', 'venice_sunset_1k.hdr', 'spruit_sunrise_1k.hdr', 'quarry_01_1k.hdr', 'moonless_golf_1k.hdr'];

function header(bytes) {
  const text = Buffer.from(bytes.subarray(0, 4096)).toString('latin1');
  const match = /\n-Y (\d+) \+X (\d+)\n/.exec(text);
  return { height: Number(match[1]), width: Number(match[2]), start: match.index + match[0].length };
}

function scanline(bytes, at, width) {
  const line = new Uint8Array(width * 4);
  if (bytes[at] !== 2 || bytes[at + 1] !== 2) {
    line.set(bytes.subarray(at, at + width * 4));
    return { line, next: at + width * 4 };
  }
  let p = at + 4;
  for (let c = 0; c < 4; c++) {
    for (let x = 0; x < width; ) {
      const count = bytes[p++];
      if (count > 128) {
        const value = bytes[p++];
        for (let i = 0; i < count - 128; i++) {
          line[(x++) * 4 + c] = value;
        }
        continue;
      }
      for (let i = 0; i < count; i++) {
        line[(x++) * 4 + c] = bytes[p++];
      }
    }
  }
  return { line, next: p };
}

function decode(bytes) {
  const { width, height, start } = header(bytes);
  const rgb = new Float32Array(width * height * 3);
  let at = start;
  for (let y = 0; y < height; y++) {
    const { line, next } = scanline(bytes, at, width);
    at = next;
    for (let x = 0; x < width; x++) {
      const e = line[x * 4 + 3];
      const f = e ? Math.pow(2, e - 136) : 0;
      for (let c = 0; c < 3; c++) {
        rgb[(y * width + x) * 3 + c] = line[x * 4 + c] * f;
      }
    }
  }
  return { width, height, rgb };
}

function shrink({ width, height, rgb }, outW) {
  const factor = width / outW;
  const outH = Math.round(height / factor);
  const out = new Float32Array(outW * outH * 3);
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const sum = [0, 0, 0];
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const i = ((y * factor + dy) * width + x * factor + dx) * 3;
          sum[0] += rgb[i];
          sum[1] += rgb[i + 1];
          sum[2] += rgb[i + 2];
        }
      }
      for (let c = 0; c < 3; c++) {
        out[(y * outW + x) * 3 + c] = sum[c] / (factor * factor);
      }
    }
  }
  return { width: outW, height: outH, rgb: out };
}

function encode({ width, height, rgb }) {
  const head = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`, 'latin1');
  const body = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const max = Math.max(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
    if (max < 1e-32) {
      continue;
    }
    const e = Math.ceil(Math.log2(max));
    const scale = 256 / Math.pow(2, e);
    for (let c = 0; c < 3; c++) {
      body[i * 4 + c] = Math.min(255, Math.floor(rgb[i * 3 + c] * scale));
    }
    body[i * 4 + 3] = e + 128;
  }
  return Buffer.concat([head, body]);
}

mkdirSync(OUT, { recursive: true });
for (const file of FILES) {
  const bytes = new Uint8Array(await (await fetch(SOURCE + file)).arrayBuffer());
  const small = encode(shrink(decode(bytes), WIDTH));
  const name = file.replace('_1k.hdr', `_${WIDTH}.hdr`);
  writeFileSync(join(OUT, name), small);
  console.log(name, small.length);
}
