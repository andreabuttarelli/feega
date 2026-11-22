import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RATE = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sfx");

const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed / 2147483647) * 2 - 1;
};

const wav = (samples) => {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));

  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write("WAVEfmt ", 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(data.length, 40);

  return Buffer.concat([head, data]);
};

const render = (seconds, fn) => Array.from({ length: Math.round(seconds * RATE) }, (_, i) => fn(i / RATE));

const click = (seed, tone) => {
  const noise = seeded(seed);
  let last = 0;

  return render(0.04, (t) => {
    const n = noise();
    const high = n - last;
    last = n;

    return 0.5 * high * Math.exp(-t / 0.004) + 0.25 * Math.sin(2 * Math.PI * tone * t) * Math.exp(-t / 0.006);
  });
};

const whoosh = () => {
  const noise = seeded(7);
  let low = 0;

  return render(0.55, (t) => {
    const p = t / 0.55;
    const cut = 0.02 + 0.12 * Math.sin(Math.PI * p);
    low += cut * (noise() - low);

    return 1.6 * low * Math.pow(Math.sin(Math.PI * p), 2);
  });
};

const thud = () => {
  const noise = seeded(3);
  let phase = 0;

  return render(0.9, (t) => {
    phase += (2 * Math.PI * (38 + 60 * Math.exp(-t / 0.08))) / RATE;
    const body = Math.sin(phase) * Math.exp(-t / 0.22);
    const hit = noise() * Math.exp(-t / 0.01) * 0.3;
    const buzz = t > 0.06 && t < 0.42 ? 0.08 * Math.sign(Math.sin(2 * Math.PI * 110 * t)) * Math.exp(-(t - 0.06) / 0.15) : 0;

    return 0.9 * body + hit + buzz;
  });
};

const pop = () => {
  let phase = 0;

  return render(0.16, (t) => {
    phase += (2 * Math.PI * (520 + 500 * (t / 0.16))) / RATE;

    return 0.35 * Math.sin(phase) * Math.exp(-t / 0.04) * Math.min(1, t / 0.004);
  });
};

mkdirSync(OUT, { recursive: true });

const SOUNDS = {
  "click-a": click(11, 2400),
  "click-b": click(23, 2900),
  "click-c": click(37, 2100),
  enter: click(51, 1500),
  whoosh: whoosh(),
  thud: thud(),
  pop: pop(),
};

for (const [name, samples] of Object.entries(SOUNDS)) {
  writeFileSync(join(OUT, `${name}.wav`), wav(samples));
}
