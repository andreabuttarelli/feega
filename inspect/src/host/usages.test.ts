import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { usageIndex } from './usages';

const FIXTURES = join(__dirname, 'impact-fixtures');

const filesOf = async (app: string, file: string) => (await usageIndex(join(FIXTURES, app)).usersOf(file)).map((u) => u.file).sort();

describe('usageIndex in React', () => {
  it('conta ogni file che importa il componente, anche via barrel e alias', async () => {
    expect(await filesOf('react', 'src/components/Button.tsx')).toEqual(['src/pages/Checkout.tsx', 'src/pages/Home.tsx', 'src/pages/Pricing.tsx']);
  });

  it('non conta il barrel che riesporta, ne i test', async () => {
    const files = await filesOf('react', 'src/components/Button.tsx');

    expect(files).not.toContain('src/components/index.ts');
    expect(files).not.toContain('src/components/Button.test.tsx');
    expect(files).not.toContain('src/pages/Footer.tsx');
  });

  it('segue un export star del barrel', async () => {
    expect(await filesOf('react', 'src/components/Tag.tsx')).toEqual(['src/pages/Checkout.tsx', 'src/pages/Footer.tsx']);
  });

  it('un componente che nessuno importa non ha usi', async () => {
    expect(await filesOf('react', 'src/components/Card.tsx')).toEqual([]);
  });

  it('punta alla riga dove il componente e usato, non all import', async () => {
    const users = await usageIndex(join(FIXTURES, 'react')).usersOf('src/components/Button.tsx');

    expect(users.find((u) => u.file === 'src/pages/Checkout.tsx')?.line).toBe(7);
    expect(users.find((u) => u.file === 'src/pages/Home.tsx')?.line).toBe(7);
  });
});

describe('usageIndex in Svelte', () => {
  it('conta le pagine che importano il componente da $lib e dal percorso diretto', async () => {
    expect(await filesOf('svelte', 'src/lib/Button.svelte')).toEqual(['src/routes/+page.svelte', 'src/routes/pricing/+page.svelte']);
  });

  it('una pagina non ha usi', async () => {
    expect(await filesOf('svelte', 'src/routes/+page.svelte')).toEqual([]);
  });
});

describe('usageIndex in Vue', () => {
  it('conta le viste che importano il componente, anche con alias @', async () => {
    expect(await filesOf('vue', 'src/components/BaseButton.vue')).toEqual(['src/views/Checkout.vue', 'src/views/Home.vue']);
  });

  it('il componente radice non ha usi', async () => {
    expect(await filesOf('vue', 'src/App.vue')).toEqual([]);
  });
});

describe('usageIndex through barrels', () => {
  it('un export star conta solo chi importa quel componente', async () => {
    expect(await filesOf('barrels', 'src/ui/Button.tsx')).toEqual(['src/A.tsx', 'src/D.tsx', 'src/E.tsx']);
    expect(await filesOf('barrels', 'src/ui/Link.tsx')).toEqual(['src/B.tsx', 'src/D.tsx', 'src/F.tsx']);
  });

  it('un barrel con import ed export separati porta al componente', async () => {
    expect(await filesOf('barrels', 'src/ui/Badge.tsx')).toEqual(['src/C.tsx']);
  });

  it('un export con nome diverso porta chi usa il nuovo nome', async () => {
    expect(await filesOf('barrels', 'src/ui/Chip.tsx')).toEqual(['src/D.tsx', 'src/G.tsx']);
  });

  it('il nome del pacchetto e un alias del suo indice', async () => {
    expect(await filesOf('barrels', 'src/ui/Button.tsx')).toContain('src/E.tsx');
  });

  it('un alias esatto dei tsconfig paths porta al barrel', async () => {
    expect(await filesOf('barrels', 'src/ui/Link.tsx')).toContain('src/F.tsx');
  });
});

describe('cache', () => {
  it('rilegge il progetto dopo invalidate', async () => {
    const index = usageIndex(join(FIXTURES, 'react'));
    await index.usersOf('src/components/Button.tsx');
    const scans = index.scans();

    await index.usersOf('src/components/Card.tsx');
    expect(index.scans()).toBe(scans);

    index.invalidate();
    await index.usersOf('src/components/Card.tsx');
    expect(index.scans()).toBe(scans + 1);
  });
});
