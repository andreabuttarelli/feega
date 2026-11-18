import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { CodeScope } from '$lib/server/code-import/canvas-import';
import { applyEdits, type SourceEdit } from '$lib/server/code-import/write-back';
import { git } from './git-cli';
import type { FramesDeps } from './frames-push';
import { linkKey, type CodeLink } from './link';
import type { LinkStore } from './link-store';
import { localGitHost, Publish } from './local-git-host';
import { memoryLock } from './push-lock';

const page = (title: string, label: string) => `import { Button } from '@/components/Button';

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-4xl font-semibold text-neutral-900" onClick={() => window.scrollTo(0, 0)}>${title}</h1>
      <Button label="${label}" />
    </main>
  );
}
`;

export const BUTTON = `'use client';

export function Button({ label, tone = 'primary' }: { label: string; tone?: 'primary' | 'ghost' }) {
  return (
    <button className={tone === 'primary' ? 'rounded-md bg-blue-600 px-4 py-2 text-white' : 'rounded-md px-4 py-2'} onClick={() => console.log('clicked', label)}>
      {label}
    </button>
  );
}
`;

export const FIXTURE: Record<string, string> = {
  'package.json': JSON.stringify({ name: 'shop', private: true, scripts: { dev: 'next dev' }, dependencies: { next: '15.0.3', react: '19.0.0', 'react-dom': '19.0.0' }, devDependencies: { tailwindcss: '3.4.14', typescript: '5.6.3' } }, null, 2),
  'tailwind.config.ts': "export default { content: ['./app/**/*.tsx', './components/**/*.tsx'] };\n",
  'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@/*': ['./*'] }, jsx: 'preserve' } }, null, 2),
  'app/layout.tsx': "import './globals.css';\n\nexport default function Layout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang=\"en\">\n      <body>{children}</body>\n    </html>\n  );\n}\n",
  'app/globals.css': '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n',
  'app/page.tsx': page('Ship faster', 'Start free'),
  'app/pricing/page.tsx': page('Simple pricing', 'Buy now'),
  'app/about/page.tsx': page('About us', 'Contact'),
  'components/Button.tsx': BUTTON
};

export const ROUTES = [
  { path: '/', file: 'app/page.tsx', params: [] },
  { path: '/pricing', file: 'app/pricing/page.tsx', params: [] },
  { path: '/about', file: 'app/about/page.tsx', params: [] }
];

export const H1_LINE = 6;
export const H1_COLUMN = 6;
export const BUTTON_LINE = 5;
export const BUTTON_COLUMN = 4;

export const USER_BRANCH = 'wip';
export const USER_DIRTY = 'README.md';

const run = async (dir: string, args: string[]) => {
  const done = await git(dir, args);
  if (done.code) {
    throw new Error(done.err);
  }
  return done.out.trim();
};

export type World = { origin: string; clone: string; at: (ref: string, path: string) => Promise<string | null>; changed: (from: string, to: string) => Promise<string[]>; run: (args: string[]) => Promise<string>; done: () => Promise<void> };

export async function fixtureWorld(): Promise<World> {
  const origin = await mkdtemp(join(tmpdir(), 'feega-origin-'));
  const clone = await mkdtemp(join(tmpdir(), 'feega-next-'));
  await run(origin, ['init', '-q', '--bare', '-b', 'main']);
  await run(clone, ['init', '-q', '-b', 'main']);
  await run(clone, ['config', 'user.email', 'dev@shop.test']);
  await run(clone, ['config', 'user.name', 'Dev']);
  for (const [path, content] of Object.entries({ ...FIXTURE, [USER_DIRTY]: 'shop\n' })) {
    await mkdir(dirname(join(clone, path)), { recursive: true });
    await writeFile(join(clone, path), content);
  }
  await run(clone, ['add', '.']);
  await run(clone, ['commit', '-qm', 'init']);
  await run(clone, ['remote', 'add', 'origin', origin]);
  await run(clone, ['push', '-q', 'origin', 'main']);
  await run(clone, ['checkout', '-q', '-b', USER_BRANCH]);
  await writeFile(join(clone, USER_DIRTY), 'shop, half written\n');

  const at = async (ref: string, path: string) => {
    const done = await git(origin, ['show', `${ref}:${path}`]);
    return done.code ? null : done.out;
  };
  const changed = async (from: string, to: string) => (await run(origin, ['diff', '--name-only', from, to])).split('\n').filter(Boolean);
  return { origin, clone, at, changed, run: (args) => run(clone, args), done: () => Promise.all([rm(origin, { recursive: true, force: true }), rm(clone, { recursive: true, force: true })]).then(() => undefined) };
}

export function memoryLinks(): LinkStore & { every: () => { nodeId: string; link: CodeLink }[] } {
  const saved = new Map<string, Map<string, CodeLink>>();
  const of = (id: string) => saved.get(id) ?? saved.set(id, new Map()).get(id)!;
  return {
    all: async (id) => [...of(id).values()],
    read: async (id) => [...of(id).values()][0] ?? null,
    save: async (id, link) => Boolean(of(id).set(linkKey(link), link)),
    remove: async (id) => saved.delete(id),
    every: () => [...saved].flatMap(([nodeId, links]) => [...links.values()].map((link) => ({ nodeId, link })))
  };
}

export type FrameEdits = Map<string, SourceEdit[]>;

export function fixtureDeps(world: World, links: LinkStore, edits: FrameEdits): FramesDeps {
  const host = localGitHost(world.clone, { publish: Publish.Origin });
  const read = (path: string) => host.readFile(path, 'main');
  return {
    host: async () => host,
    links,
    lock: memoryLock(),
    edits: async (_scope, nodeId) => {
      const done = await applyEdits(edits.get(nodeId) ?? [], read);
      return { repo: world.clone, kind: 'folder', files: done.files.map((f) => ({ path: f.path, content: f.after })), skipped: done.skipped };
    }
  };
}

export const NO_SCOPE = {} as CodeScope;
