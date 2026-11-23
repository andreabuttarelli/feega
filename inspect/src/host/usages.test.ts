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
