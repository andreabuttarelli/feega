import { describe, expect, it } from 'vitest';
import { freeCatalog, installable, publicAssets, registryUrl, supportPaths, type OssRegistry, type RegistryItem } from './registry';

const SHA = 'f6b20860623fa39122ac2b5f0e5bd29a9eb10941';

const oss: OssRegistry = {
  items: [
    { name: 'halo-reel', type: 'registry:ui', title: 'Halo Reel', description: 'Image cards on a ring.' },
    { name: 'halo-reel-demo', type: 'registry:example', title: 'Halo Reel Demo', description: 'Example.' },
    { name: 'utils', type: 'registry:lib' }
  ]
};

const item = (target: string, content = 'import { cn } from "@/lib/utils";', type = 'registry:ui'): RegistryItem => ({ name: 'halo-reel', type, files: [{ path: 'registry/ruixenui/halo-reel.tsx', target, content }] });

describe('the pinned Ruixen catalog', () => {
  it('publishes the images its demos show from the same commit', () => {
    expect(freeCatalog(oss, SHA, '2026-11-12T00:00:00.000Z').publicBase).toBe(`https://raw.githubusercontent.com/ruixenui/ruixen.com/${SHA}/public/`);
  });

  it('keeps the components of the open-source registry, pinned to one commit', () => {
    expect(freeCatalog(oss, SHA, '2026-11-12T00:00:00.000Z').items).toEqual([{ name: 'halo-reel', title: 'Halo Reel', description: 'Image cards on a ring.', tier: 'free', registry: registryUrl(SHA, 'halo-reel') }]);
  });
});

describe('a Ruixen registry item', () => {
  it('lands its component under src/components/ruixen', () => {
    expect(installable(registryUrl(SHA, 'halo-reel'), item('components/ruixen/halo-reel.tsx'))).toMatchObject({ ok: true, files: [{ path: 'src/components/ruixen/halo-reel.tsx' }] });
  });

  it('lands its demo under the library and points it at the landed component', () => {
    const demo = item('components/halo-reel-demo.tsx', 'import { HaloReel } from "@/registry/ruixenui/halo-reel";', 'registry:example');
    expect(installable(registryUrl(SHA, 'halo-reel-demo'), demo)).toEqual({ ok: true, files: [{ path: 'src/components/ruixen/demos/halo-reel-demo.tsx', content: 'import { HaloReel } from "@/components/ruixen/halo-reel";' }], dependencies: [] });
  });

  it('a demo that imports its component by a relative path finds it too', () => {
    const demo = item('components/halo-reel-demo.tsx', 'import HaloReel from "../ruixenui/halo-reel";', 'registry:example');
    expect(installable(registryUrl(SHA, 'halo-reel-demo'), demo)).toMatchObject({ ok: true, files: [{ content: 'import HaloReel from "@/components/ruixen/halo-reel";' }] });
  });

  it('an item served from Ruixen Pro never lands', () => {
    expect(installable('https://pro.ruixen.com/r/intellune.json', item('components/ruixen/halo-reel.tsx')).ok).toBe(false);
  });

  it('an item from another commit never lands', () => {
    expect(installable(registryUrl('main', 'halo-reel'), item('components/ruixen/halo-reel.tsx')).ok).toBe(false);
  });

  it('a target that climbs out of the library is refused', () => {
    expect(installable(registryUrl(SHA, 'halo-reel'), item('components/ruixen/../../package.json')).ok).toBe(false);
  });

  it('an item that needs the Next.js runtime is refused with its reason', () => {
    expect(installable(registryUrl(SHA, 'halo-reel'), item('components/ruixen/halo-reel.tsx', 'import { usePathname } from "next/navigation";'))).toEqual({ ok: false, reason: 'halo-reel imports next/navigation, which a plain Vite app does not have' });
  });
});

describe('the support files a Ruixen component imports', () => {
  it('are the shadcn primitives and hooks it names, never the site utils', () => {
    expect(supportPaths('import { Button } from "@/components/ui/button";\nimport { cn } from "@/lib/utils";\nimport { x } from "@/hooks/use-mounted";')).toEqual(['components/ui/button.tsx', 'hooks/use-mounted.ts']);
  });
});

describe('the public files a Ruixen demo shows', () => {
  it('are the site-root images it names; videos and paths that climb out stay behind', () => {
    expect(publicAssets('<img src="/logos/gong.svg" /> src: "/avatar-images/avatar-01.jpg" href="/docs" src="/../x.png" src="/demo.mp4"')).toEqual(['logos/gong.svg', 'avatar-images/avatar-01.jpg']);
  });
});
