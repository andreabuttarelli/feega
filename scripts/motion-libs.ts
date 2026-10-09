import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { build } from 'esbuild';
import type { Plugin } from 'vite';
import { HOSTED, MODULES, MODULE_EXTERNAL, MOTION_LIBS_ROUTE, OPENTYPE, Packing, folderOf, type Hosted, type HostedModule, type Script } from '../src/lib/motion/libs/catalog';

export const MOTION_LIBS_MODULE = 'virtual:motion-libs';
export const MOTION_LIBS_DIR = 'static/motion-libs';

export type Integrity = Record<Script, string>;

const packageDir = (root: string, pkg: string) => join(root, 'node_modules', pkg);

function pinned(root: string, lib: { pkg: string; version: string }): string {
  const dir = packageDir(root, lib.pkg);
  const { version } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { version: string };
  if (version !== lib.version) {
    throw new Error(`motion libs: ${lib.pkg} is ${version}, pinned ${lib.version}`);
  }
  return dir;
}

function put(file: string, bytes: string | Buffer) {
  if (existsSync(file) && readFileSync(file).equals(Buffer.from(bytes))) {
    return;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
}

async function packed(dir: string, lib: Hosted): Promise<Buffer> {
  const entry = join(dir, lib.source);
  if (lib.packing === Packing.Copy) {
    return readFileSync(entry);
  }
  const banner = `/*! ${lib.name} ${lib.version} | ${lib.licence} | ${lib.home} */`;
  const out = await build({ entryPoints: [entry], bundle: true, minify: true, format: 'iife', globalName: lib.global, target: 'es2020', write: false, legalComments: 'inline', banner: { js: banner } });
  return Buffer.from(out.outputFiles[0].text);
}

async function esm(dir: string, module: HostedModule): Promise<Buffer> {
  const external = module.source === MODULES[MODULE_EXTERNAL].source ? [] : [MODULE_EXTERNAL];
  const out = await build({ entryPoints: [join(dir, module.source)], bundle: true, minify: true, format: 'esm', external, target: 'es2020', write: false, legalComments: 'inline' });
  return Buffer.from(out.outputFiles[0].text);
}

export const libraryPath = (root: string, pathname: string) => join(root, MOTION_LIBS_DIR, decodeURIComponent(pathname.slice(MOTION_LIBS_ROUTE.length)));

const sri = (bytes: Buffer) => `sha384-${createHash('sha384').update(bytes).digest('base64')}`;

export async function writeMotionLibs(root: string): Promise<Integrity> {
  const out = join(root, MOTION_LIBS_DIR);
  const integrity: Partial<Integrity> = {};

  for (const [script, lib] of Object.entries(HOSTED) as [Script, Hosted][]) {
    const dir = pinned(root, lib);
    const bytes = await packed(dir, lib);
    put(join(out, folderOf(lib), lib.file), bytes);
    put(join(out, folderOf(lib), lib.licenceFile), readFileSync(join(dir, lib.licenceFile)));
    integrity[script] = sri(bytes);
  }

  const opentype = pinned(root, OPENTYPE);
  put(join(out, folderOf(OPENTYPE), OPENTYPE.licenceFile), readFileSync(join(opentype, OPENTYPE.licenceFile)));

  for (const module of Object.values(MODULES)) {
    const dir = pinned(root, module.lib);
    put(join(out, folderOf(module.lib), module.file), await esm(dir, module));
    put(join(out, folderOf(module.lib), module.lib.licenceFile), readFileSync(join(dir, module.lib.licenceFile)));
  }

  return integrity as Integrity;
}

const resolved = `\0${MOTION_LIBS_MODULE}`;

export function motionLibs(): Plugin {
  let written: Promise<Integrity> | null = null;
  const ready = (root: string) => (written ??= writeMotionLibs(root));
  let root = process.cwd();
  return {
    name: 'motion-libs',
    configResolved: (config) => {
      root = config.root;
    },
    buildStart: async () => {
      await ready(root);
    },
    resolveId: (id) => (id === MOTION_LIBS_MODULE ? resolved : null),
    load: async (id) => (id === resolved ? `export default ${JSON.stringify(await ready(root))};` : null),
    configureServer: (server) => {
      server.middlewares.use(MOTION_LIBS_ROUTE, (_req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        next();
      });
    }
  };
}
