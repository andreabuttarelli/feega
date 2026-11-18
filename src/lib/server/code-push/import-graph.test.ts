import { describe, expect, it } from 'vitest';
import { importGraph } from './import-graph';

const repo: Record<string, string> = {
  'app/page.tsx': "import { Hero } from '@/components/Hero';\nimport Card from '../components/Card';\nimport { clsx } from 'clsx';\nexport default () => <Hero />;",
  'components/Hero.tsx': "import { Button } from './ui';\nexport const Hero = () => <Button />;",
  'components/ui/index.ts': "export * from './Button';",
  'components/ui/Button.tsx': 'export const Button = () => <button />;',
  'components/Card.tsx': "import Card from './Card';\nexport default Card;"
};

const read = async (path: string) => repo[path] ?? null;

describe('il grafo degli import di una pagina', () => {
  it('segue import relativi, alias @/ e index, salta i pacchetti e i cicli', async () => {
    const graph = await importGraph('app/page.tsx', read);

    expect(graph.sort()).toEqual(['app/page.tsx', 'components/Card.tsx', 'components/Hero.tsx', 'components/ui/Button.tsx', 'components/ui/index.ts']);
  });

  it('un import che non si risolve resta fuori', async () => {
    expect(await importGraph('app/page.tsx', async (p) => (p === 'app/page.tsx' ? "import x from './missing';" : null))).toEqual(['app/page.tsx']);
  });
});
