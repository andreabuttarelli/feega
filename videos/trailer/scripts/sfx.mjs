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

const CHIME_NOTES = [
  { at: 0, freq: 880 },
  { at: 0.16, freq: 659.25 },
];

const chime = () =>
  render(1.0, (t) =>
    CHIME_NOTES.reduce((sum, { at, freq }) => {
      const u = t - at;

      if (u < 0) {
        return sum;
      }

      const env = Math.min(1, u / 0.005) * Math.exp(-u / 0.2);
      const tone = Math.sin(2 * Math.PI * freq * u) + 0.3 * Math.sin(2 * Math.PI * 2 * freq * u) * Math.exp(-u / 0.08) + 0.12 * Math.sin(2 * Math.PI * 3 * freq * u) * Math.exp(-u / 0.05);

      return sum + 0.4 * env * tone;
    }, 0),
  );

const pop = () => {
  let phase = 0;

  return render(0.16, (t) => {
    phase += (2 * Math.PI * (520 + 500 * (t / 0.16))) / RATE;

    return 0.35 * Math.sin(phase) * Math.exp(-t / 0.04) * Math.min(1, t / 0.004);
  });
};

const tap = () => {
  const noise = seeded(89);

  return render(0.05, (t) => {
    const body = Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t / 0.006);
    const grain = noise() * Math.exp(-t / 0.002);

    return 0.22 * (body + 0.4 * grain) * Math.min(1, t / 0.0008);
  });
};

const power = () => {
  const noise = seeded(101);
  let phase = 0;

  return render(0.9, (t) => {
    const p = t / 0.9;
    phase += (2 * Math.PI * (60 + 260 * p * p)) / RATE;
    const hum = 0.22 * Math.sin(phase) * Math.sin(Math.PI * p) * (1 + 0.3 * Math.sin(2 * Math.PI * 120 * t));
    const snap = 0.45 * noise() * Math.exp(-t / 0.003);

    return hum + snap;
  });
};

const mouse = () => {
  const noise = seeded(131);
  const press = (u) => (u < 0 ? 0 : (0.5 * noise() * Math.exp(-u / 0.0015) + 0.3 * Math.sin(2 * Math.PI * 3200 * u)) * Math.exp(-u / 0.004));

  return render(0.12, (t) => press(t) + 0.6 * press(t - 0.07));
};

const CLATTER_TAPS = [0, 0.018, 0.031, 0.047, 0.06, 0.074, 0.083, 0.097];

const clatter = () => {
  const keys = CLATTER_TAPS.map((at, i) => ({ at, samples: click(141 + 17 * i, 2100 + 160 * (i % 4)) }));

  return render(0.15, (t) => keys.reduce((sum, { at, samples }) => sum + (samples[Math.round((t - at) * RATE)] ?? 0) * 0.8, 0));
};

mkdirSync(OUT, { recursive: true });

const SOUNDS = {
  "click-a": click(11, 2400),
  "click-b": click(23, 2900),
  "click-c": click(37, 2100),
  enter: click(51, 1500),
  whoosh: whoosh(),
  backspace: click(67, 1100),
  chime: chime(),
  pop: pop(),
  tap: tap(),
  power: power(),
  mouse: mouse(),
  clatter: clatter(),
};

for (const [name, samples] of Object.entries(SOUNDS)) {
  writeFileSync(join(OUT, `${name}.wav`), wav(samples));
}
