import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Watch } from './file-watch';
import { usageIndex } from './usages';

const FIXTURE = join(__dirname, 'impact-fixtures/react');
const SECONDS_LATER_MS = 4000;
const MINUTES_LATER_MS = 10 * 60_000;
const CARD = 'src/components/Card.tsx';

const copied = () => {
  const root = mkdtempSync(join(tmpdir(), 'feega-usages-'));
  cpSync(FIXTURE, root, { recursive: true });
  return root;
};

const fakeWatch = () => {
  let fire = () => undefined as void;
  let stopped = 0;
  const watch: Watch = (_root, changed) => {
    fire = changed;
    return { dispose: () => void stopped++ };
  };
  return { watch, fire: () => fire(), stopped: () => stopped };
};

describe('cache invalidation by file changes', () => {
  it('un file nuovo che importa il componente compare senza aspettare la scadenza', async () => {
    const root = copied();
    const { watch, fire } = fakeWatch();
    const index = usageIndex(root, { watch });
    expect(await index.usersOf(CARD)).toEqual([]);

    writeFileSync(join(root, 'src/pages/Team.tsx'), "import { Card } from '../components/Card';\n\nexport const team = Card;\n");
    fire();

    expect((await index.usersOf(CARD)).map((u) => u.file)).toEqual(['src/pages/Team.tsx']);
  });

  it('senza cambiamenti nel progetto la scansione si riusa dopo qualche secondo', async () => {
    let time = 0;
    const index = usageIndex(copied(), { now: () => time, watch: fakeWatch().watch });
    await index.usersOf(CARD);

    time += SECONDS_LATER_MS;
    await index.usersOf(CARD);

    expect(index.scans()).toBe(1);
  });

  it('una rete di sicurezza rilegge comunque dopo una scadenza lunga', async () => {
    let time = 0;
    const index = usageIndex(copied(), { now: () => time, watch: fakeWatch().watch });
    await index.usersOf(CARD);

    time += MINUTES_LATER_MS;
    await index.usersOf(CARD);

    expect(index.scans()).toBe(2);
  });

  it('dispose ferma il watcher', async () => {
    const { watch, stopped } = fakeWatch();
    const index = usageIndex(copied(), { watch });
    await index.usersOf(CARD);

    index.dispose();

    expect(stopped()).toBe(1);
  });
});
