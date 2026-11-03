import { strToU8, zipSync } from 'fflate';
import type { CodeAsset, CodeFile } from '@feega/motion-core/motion/codegen/index';

export type FetchBytes = (url: string) => Promise<Uint8Array | null>;

export function zipFolder(folder: string, files: Record<string, string>): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(files).map(([path, text]) => [`${folder}/${path}`, strToU8(text)])));
}

export const fetchBytes: FetchBytes = async (url) => {
  try {
    const res = await fetch(url);
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
};

const quoted = (ref: string) => new RegExp(`(["'(])${ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(["')])`, 'g');

export async function zipCode(folder: string, code: { files: CodeFile[]; assets: CodeAsset[] }, fetch: FetchBytes = fetchBytes): Promise<Uint8Array> {
  const fetched = await Promise.all(code.assets.map(async (asset) => ({ asset, bytes: await fetch(asset.url) })));
  const missing = fetched.filter((f) => !f.bytes).map((f) => f.asset);
  const relinked = (text: string) => missing.reduce((out, a) => out.replace(quoted(a.ref), `$1${a.url}$2`), text);

  const texts = code.files.map((f) => [`${folder}/${f.path}`, strToU8(relinked(f.content))] as const);
  const images = fetched.flatMap(({ asset, bytes }) => (bytes ? [[`${folder}/${asset.path}`, bytes] as const] : []));
  return zipSync(Object.fromEntries([...texts, ...images]));
}
