import { existsSync, readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseMotionDoc } from '@feega/motion-core/motion/doc';
import { unpackFeega } from '$lib/canvas/feega-file';
import liquidGlass from '$lib/motion/fixtures/liquid-glass-title.json';
import supasito from '$lib/motion/fixtures/supasito-v1.json';
import ruixen from '$lib/motion/template/ruixen/ruixen-doc.json';
import demo from '../../../../scripts/seed/demo-motion-doc.json';

const env = vi.hoisted(() => ({ APP_SECRET: 'test-secret-for-motion-docs' }) as Record<string, string | undefined>);
vi.mock('$env/dynamic/private', () => ({ env }));

const parses = vi.hoisted(() => ({ count: 0 }));
vi.mock('@feega/motion-core/motion/doc', async (original) => {
  const real = await original<typeof import('@feega/motion-core/motion/doc')>();
  return {
    ...real,
    parseMotionDoc: (input: unknown) => {
      parses.count += 1;
      return real.parseMotionDoc(input);
    }
  };
});

const { openDoc, sealDoc } = await import('./sealed-doc');

const STRESS_FILE = process.env.MOTION_DOC_FIXTURE;

type Raw = Record<string, unknown>;

const clipsOf = (doc: Raw) => (doc.tracks as { clips: Raw[] }[]).flatMap((t) => t.clips);

function olderShape(version: number | undefined, drop: string[]): Raw {
  const doc = structuredClone(demo) as Raw;
  for (const clip of clipsOf(doc)) {
    drop.forEach((key) => delete clip[key]);
  }
  if (version === undefined) {
    delete doc.version;
  } else {
    doc.version = version;
  }
  delete doc.comps;
  return doc;
}

const OLDER: [string, Raw][] = [
  ['v1, no version field', olderShape(undefined, [])],
  ['v2', olderShape(2, ['mask', 'matte', 'depth', 'space', 'parent', 'parentOpacity'])],
  ['v3', olderShape(3, ['depth', 'space', 'parent', 'parentOpacity'])],
  ['v4', olderShape(4, ['parent', 'parentOpacity'])]
];

function stressDocs(): [string, unknown][] {
  if (!STRESS_FILE || !existsSync(STRESS_FILE)) {
    return [];
  }
  const opened = unpackFeega(new Uint8Array(readFileSync(STRESS_FILE)));
  return opened.ok ? Object.entries(opened.file.canvas.heads).map(([id, head]) => [`stress ${id}`, head.doc]) : [];
}

const FIXTURES: [string, unknown][] = [
  ['demo seed', demo],
  ['liquid glass title', liquidGlass],
  ['supasito v1', supasito],
  ...OLDER,
  ...(ruixen as { slug: string; doc: unknown }[]).map((t): [string, unknown] => [`ruixen ${t.slug}`, t.doc]),
  ...stressDocs()
];

const byteOrder = (a: string, b: string) => Buffer.byteLength(a) - Buffer.byteLength(b) || (a < b ? -1 : a > b ? 1 : 0);

function asJsonb(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(asJsonb);
  }
  if (value && typeof value === 'object') {
    const object = value as Raw;
    return Object.fromEntries(Object.keys(object).sort(byteOrder).map((k) => [k, asJsonb(object[k])]));
  }
  return value;
}

const STORES: [string, (doc: unknown) => unknown][] = [
  ['postgres jsonb', (doc) => JSON.parse(JSON.stringify(asJsonb(doc)))],
  ['.feega file', (doc) => JSON.parse(JSON.stringify(doc))]
];

function written(doc: unknown) {
  const parsed = parseMotionDoc(doc);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return { parsed: parsed.doc, stored: sealDoc(parsed.doc) };
}

function readCounted(stored: unknown) {
  parses.count = 0;
  const read = openDoc(stored);
  return { read, parsed: parses.count };
}

beforeEach(() => {
  env.APP_SECRET = 'test-secret-for-motion-docs';
});

describe('a sealed motion doc', () => {
  it.each(STORES)('reads back equal to the full parse of the original, without parsing, from %s', (_, store) => {
    const unequal = FIXTURES.flatMap(([name, doc]) => {
      const { parsed, stored } = written(doc);
      const { read, parsed: count } = readCounted(store(stored));
      const again = parseMotionDoc(store(stored));
      const same = read.ok && again.ok && isDeepStrictEqual(read.doc, parsed) && isDeepStrictEqual(again.doc, parsed);
      return same && count === 0 ? [] : [{ name, same, count }];
    });

    expect(FIXTURES.length).toBeGreaterThan(150);
    expect(unequal).toEqual([]);
  });

  it('every older shape upgrades on the write that seals it', () => {
    for (const [, doc] of OLDER) {
      const { parsed, stored } = written(doc);

      expect(isDeepStrictEqual(stored, parsed)).toBe(false);
      expect(openDoc(stored)).toEqual({ ok: true, doc: parsed });
    }
  });

  it('never shows its seal to the reader', () => {
    const { stored } = written(demo);
    const read = openDoc(stored);

    expect(Object.keys(stored)).toContain('$seal');
    expect(read.ok && Object.keys(read.doc)).not.toContain('$seal');
  });

  it('an older reader strips the seal like any unknown field', () => {
    const { parsed, stored } = written(supasito);
    const old = parseMotionDoc(stored);

    expect(old.ok && isDeepStrictEqual(old.doc, parsed)).toBe(true);
  });
});

describe('a seal the reader does not trust goes through the full parse', () => {
  it('an unsealed doc', () => {
    const { read, parsed } = readCounted(demo);

    expect(parsed).toBe(1);
    expect(read).toEqual(parseMotionDoc(demo));
  });

  it('a doc edited after it was sealed', () => {
    const { stored } = written(demo);
    const edited = { ...stored, fps: 7 };
    const { read, parsed } = readCounted(edited);

    expect(parsed).toBe(1);
    expect(read.ok).toBe(false);
  });

  it('a seal copied from another doc', () => {
    const one = written(demo).stored as Raw;
    const other = written(liquidGlass).stored as Raw;

    expect(readCounted({ ...other, $seal: one.$seal }).parsed).toBe(1);
  });

  it('a seal from another schema stamp', () => {
    const stored = written(demo).stored as Raw;
    const [, mac] = String(stored.$seal).split('.');

    expect(readCounted({ ...stored, $seal: `0000000000000000.${mac}` }).parsed).toBe(1);
  });

  it('a seal made with another secret', () => {
    const stored = written(demo).stored;
    env.APP_SECRET = 'another-deployment';

    expect(readCounted(stored).parsed).toBe(1);
  });

  it('nothing is sealed or trusted without a configured secret', () => {
    const sealed = written(demo).stored;
    env.APP_SECRET = undefined;

    expect(Object.keys(written(demo).stored)).not.toContain('$seal');
    expect(readCounted(sealed).parsed).toBe(1);
  });

  it('nothing is sealed or trusted with the insecure default secret', () => {
    env.APP_SECRET = 'dev-insecure-secret-change-me';

    expect(Object.keys(written(demo).stored)).not.toContain('$seal');
  });
});
