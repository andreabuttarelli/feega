import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ViteDevServer } from 'vite';

const CONTAINER_ENTRY = 'astro/container';
const STYLE_QUERY = /[?&]astro&type=style/;
const DIRECT_CSS = '&direct';

type Container = { renderToString: (component: unknown, options: { props: Record<string, unknown> }) => Promise<string> };
type ContainerModule = { experimental_AstroContainer: { create: () => Promise<Container> } };

async function containerOf(root: string): Promise<Container> {
  const entry = createRequire(join(root, 'package.json')).resolve(CONTAINER_ENTRY);
  const { experimental_AstroContainer } = (await import(pathToFileURL(entry).href)) as ContainerModule;
  return experimental_AstroContainer.create();
}

async function stylesOf(server: ViteDevServer, url: string): Promise<string> {
  const module = await server.moduleGraph.getModuleByUrl(url, true);
  const styles = [...(module?.importedModules ?? [])].filter((imported) => STYLE_QUERY.test(imported.url));
  const css = await Promise.all(styles.map(async (style) => (await server.transformRequest(style.url + DIRECT_CSS))?.code ?? ''));
  return css.length ? `<style>${css.join('\n')}</style>` : '';
}

export async function renderAstro(server: ViteDevServer, root: string, file: string, props: Record<string, unknown>): Promise<string> {
  const url = `/${file}`;
  const module = await server.ssrLoadModule(url);
  const html = await (await containerOf(root)).renderToString(module.default, { props });
  return (await stylesOf(server, url)) + html;
}
