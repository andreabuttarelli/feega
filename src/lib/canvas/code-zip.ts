import { strToU8, zipSync } from 'fflate';

export function zipFolder(folder: string, files: Record<string, string>): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(files).map(([path, text]) => [`${folder}/${path}`, strToU8(text)])));
}
