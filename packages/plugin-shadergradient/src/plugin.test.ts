import { describe, expect, it } from 'vitest';
import { createApi, type Port } from '@feega/plugin-api/client';
import { createPluginHost, type EditorPort } from '@feega/plugin-api/host';
import { parseManifest } from '@feega/plugin-api/manifest';
import { Control, OpKind, Place, type HostMessage, type PluginMessage, type ProjectInfo, type Proposal, type Selection } from '@feega/plugin-api/protocol';
import manifest from '../feega-plugin.json';
import { SECTION, shaderGradientPlugin } from './plugin';

const PAGE = `export default function Page() {
  return (
    <section className="hero">
      <ShaderGradientBackground type="plane" uSpeed={0.2} color1="#ff5005" />
    </section>
  );
}
`;

const TARGET = { file: 'src/Page.tsx', line: 3, col: 5 };

const SELECTED: Selection = { source: TARGET, component: null, tag: 'section', name: 'section.hero', classes: 'hero', rect: { x: 0, y: 0, width: 400, height: 300 }, styles: {}, attributes: [] };

const REACT_19 = { react: '^19.0.0', 'react-dom': '^19.0.0' };

function load(options: { packages?: Record<string, string>; text?: string | null; typescript?: boolean } = {}) {
  const parsed = parseManifest(manifest);
  if (!parsed.ok) {
    throw new Error(parsed.reason);
  }
  const proposals: Proposal[] = [];
  const notices: string[] = [];
  let toHost: (m: PluginMessage) => void = () => undefined;
  let toPlugin: (m: HostMessage) => void = () => undefined;
  const editor: EditorPort = {
    selection: () => null,
    project: async (): Promise<ProjectInfo> => ({ typescript: options.typescript ?? true, publicDir: 'public', packages: options.packages ?? REACT_19 }),
    sourceText: async () => (options.text === undefined ? PAGE : options.text),
    propose: async (p) => (proposals.push(p), { ok: true }),
    preview: () => undefined,
    fetch: async () => ({ status: 200, text: '' }),
    pickFile: async () => null,
    notify: (text) => notices.push(text)
  };
  const host = createPluginHost({ editor, sandbox: () => ({ post: (m) => queueMicrotask(() => toPlugin(m)), listen: (h) => (toHost = h), close: () => undefined }) });
  host.load(parsed.manifest, '');
  const port: Port = { post: (m) => queueMicrotask(() => toHost(m)), listen: (h) => (toPlugin = h) };
  shaderGradientPlugin(createApi(port));
  const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
  const id = parsed.manifest.id;
  return {
    proposals,
    notices,
    ui: () => host.ui(id, SECTION),
    insert: async (target = TARGET) => (host.menu(id, 'insert', target, Place.Auto), settle()),
    control: async (control: string, value: string | number | boolean) => (host.control(id, SECTION, control, value), settle()),
    select: async (next: Selection | null) => (host.selectionChanged(next), settle())
  };
}

describe('manifest', () => {
  it('is named as a community plugin and asks for no network', () => {
    const parsed = parseManifest(manifest);
    expect(parsed.ok && parsed.manifest.name).toBe('ShaderGradient (community)');
    expect(parsed.ok && parsed.manifest.hosts).toEqual([]);
  });
});

describe('the Properties section', () => {
  it('is empty until an element with a gradient is selected', async () => {
    const plugin = load({ text: '<section><p>no gradient</p></section>\n' });
    await plugin.select({ ...SELECTED, source: { file: 'src/Page.tsx', line: 1, col: 1 } });
    expect(plugin.ui()).toEqual([]);
  });

  it('shows the props of the gradient in the selected element', async () => {
    const plugin = load();
    await plugin.select(SELECTED);
    expect(plugin.ui()).toContainEqual(expect.objectContaining({ type: Control.Colour, id: 'color1', value: '#ff5005' }));
    expect(plugin.ui()).toContainEqual(expect.objectContaining({ type: Control.Slider, id: 'uSpeed', value: 0.2 }));
  });

  it('writes a number as a brace expression on the gradient tag', async () => {
    const plugin = load();
    await plugin.select(SELECTED);
    await plugin.control('uSpeed', 0.6);
    expect(plugin.proposals).toEqual([{ label: 'ShaderGradient', ops: [{ kind: OpKind.Attributes, at: 'src/Page.tsx:3:5', tag: 'ShaderGradientBackground', set: {}, numbers: { uSpeed: 0.6 } }] }]);
  });

  it('writes a colour as a string and updates the field', async () => {
    const plugin = load();
    await plugin.select(SELECTED);
    await plugin.control('color1', '#00ff88');
    expect(plugin.proposals[0].ops[0]).toMatchObject({ set: { color1: '#00ff88' }, numbers: {} });
    expect(plugin.ui()).toContainEqual(expect.objectContaining({ id: 'color1', value: '#00ff88' }));
  });

  it('ignores a control that is not a gradient prop', async () => {
    const plugin = load();
    await plugin.select(SELECTED);
    await plugin.control('onClick', 'x');
    expect(plugin.proposals).toEqual([]);
  });
});

describe('inserting a gradient', () => {
  it('asks for the missing packages of the React 19 line, the component and its props', async () => {
    const plugin = load();
    await plugin.insert();
    const [proposal] = plugin.proposals;
    expect(proposal.label).toBe('ShaderGradient');
    expect(proposal.ops.map((op) => op.kind)).toEqual([OpKind.Dependency, OpKind.Dependency, OpKind.Dependency, OpKind.Insert]);
    expect(proposal.ops[1]).toEqual({ kind: OpKind.Dependency, name: '@react-three/fiber', version: '^9.0.0' });
    expect(proposal.ops[3]).toMatchObject({ kind: OpKind.Insert, at: 'src/Page.tsx:3:5', component: { name: 'ShaderGradientBackground', file: 'src/feega/ShaderGradientBackground.tsx', attributes: expect.stringContaining('color1="#ff5005"') } });
  });

  it('asks for no package when they are all there', async () => {
    const plugin = load({ packages: { ...REACT_19, '@shadergradient/react': '^2.4.20', '@react-three/fiber': '^9.0.0', three: '^0.169.0' } });
    await plugin.insert();
    expect(plugin.proposals[0].ops.map((op) => op.kind)).toEqual([OpKind.Insert]);
  });

  it('writes a javascript component in a javascript project', async () => {
    const plugin = load({ typescript: false });
    await plugin.insert();
    expect(plugin.proposals[0].ops.at(-1)).toMatchObject({ component: { file: 'src/feega/ShaderGradientBackground.jsx' } });
  });

  it('marks the component as a client component in Next.js only', async () => {
    const next = load({ packages: { ...REACT_19, next: '^15.0.0' } });
    await next.insert();
    expect(next.proposals[0].ops.at(-1)).toMatchObject({ component: { source: expect.stringMatching(/^'use client';/) } });
    const plain = load();
    await plain.insert();
    expect(plain.proposals[0].ops.at(-1)).toMatchObject({ component: { source: expect.not.stringContaining('use client') } });
  });

  it('mounts it in the browser only in Astro', async () => {
    const plugin = load({ packages: { ...REACT_19, '@astrojs/react': '^4.0.0' } });
    await plugin.insert({ file: 'src/pages/index.astro', line: 3, col: 1 });
    expect(plugin.proposals[0].ops.at(-1)).toMatchObject({ component: { attributes: expect.stringContaining('client:only="react"') } });
  });

  it.each([
    ['src/pages/index.astro', {}, '@astrojs/react'],
    ['src/App.vue', {}, 'Vue'],
    ['src/routes/+page.svelte', {}, 'Svelte']
  ])('says why it is unavailable in %s and changes nothing', async (file, extra, word) => {
    const plugin = load({ packages: { ...REACT_19, ...extra } });
    await plugin.insert({ file, line: 1, col: 1 });
    expect(plugin.proposals).toEqual([]);
    expect(plugin.notices[0]).toContain(word);
  });

  it('refuses a React major the package does not support', async () => {
    const plugin = load({ packages: { react: '^17.0.2' } });
    await plugin.insert();
    expect(plugin.proposals).toEqual([]);
    expect(plugin.notices[0]).toContain('React 18 or 19');
  });

  it('refuses a file that is not a component', async () => {
    const plugin = load();
    await plugin.insert({ file: 'index.html', line: 1, col: 1 });
    expect(plugin.proposals).toEqual([]);
    expect(plugin.notices).toHaveLength(1);
  });
});
