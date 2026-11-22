export type ManifestFile = { url: string; sha512: string };

export type Manifest = { version: string; files: Partial<Record<string, ManifestFile>> };

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

export const urlAllowed = (raw: string): boolean => {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname));
  } catch {
    return false;
  }
};

const fileOf = (value: unknown): ManifestFile | null => {
  const file = value as Partial<ManifestFile> | null;
  return file && typeof file.url === 'string' && typeof file.sha512 === 'string' && urlAllowed(file.url) ? { url: file.url, sha512: file.sha512 } : null;
};

export const parseManifest = (raw: unknown): Manifest | null => {
  const manifest = raw as { version?: unknown; files?: unknown } | null;
  if (!manifest || typeof manifest.version !== 'string' || typeof manifest.files !== 'object' || manifest.files === null) {
    return null;
  }
  const files: Manifest['files'] = {};
  for (const [arch, value] of Object.entries(manifest.files)) {
    const file = fileOf(value);
    if (file) {
      files[arch] = file;
    }
  }
  return { version: manifest.version, files };
};

export const fileFor = (manifest: Manifest, arch: string): ManifestFile | null => manifest.files[arch] ?? null;
