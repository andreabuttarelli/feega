import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;

const covers = [
  { file: 'public/og-default.png', lines: ['Feega blog'], kicker: 'blog.feega.app' },
  { file: 'public/covers/introducing-feega.png', lines: ['One canvas for', 'design, motion and AI'], kicker: 'Introducing Feega' },
  { file: 'public/covers/rust-canvas-renderer.png', lines: ['Rust, WebGPU, WASM.', 'One engine.'], kicker: 'Why we wrote the renderer in Rust' }
];

function svg({ lines, kicker }) {
  const text = lines
    .map((line, i) => `<text x="80" y="${330 + i * 84}" font-size="76" font-weight="600" letter-spacing="-3">${line}</text>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <rect width="100%" height="100%" fill="#0a0a0a"/>
    <g font-family="Helvetica Neue, Arial, sans-serif" fill="#ededed">
      <text x="80" y="120" font-size="34" font-weight="600" letter-spacing="-1">Feega</text>
      ${text}
      <circle cx="88" cy="545" r="8" fill="#ff5100"/>
      <text x="112" y="556" font-size="28" fill="#8a8a8a">${kicker}</text>
    </g>
  </svg>`;
}

for (const cover of covers) {
  await sharp(Buffer.from(svg(cover))).png().toFile(cover.file);
}
