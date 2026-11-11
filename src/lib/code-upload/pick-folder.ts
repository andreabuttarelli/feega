import { keptDir, snapshotOf, type PickedFile, type Snapshot } from './snapshot';

type FileHandle = { kind: 'file'; name: string; getFile: () => Promise<File> };
type DirHandle = { kind: 'directory'; name: string; values: () => AsyncIterable<FileHandle | DirHandle> };
type PickerWindow = Window & { showDirectoryPicker?: () => Promise<DirHandle> };

const fromFile = (path: string, file: File): PickedFile => ({ path, size: file.size, bytes: async () => new Uint8Array(await file.arrayBuffer()) });

async function walked(dir: DirHandle, base = '', out: PickedFile[] = []): Promise<PickedFile[]> {
  for await (const entry of dir.values()) {
    const path = base ? `${base}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') {
      if (keptDir(entry.name)) {
        await walked(entry, path, out);
      }
      continue;
    }
    out.push(fromFile(path, await entry.getFile()));
  }
  return out;
}

export const canPickDirectory = () => typeof window !== 'undefined' && typeof (window as PickerWindow).showDirectoryPicker === 'function';

export async function pickDirectory(): Promise<Snapshot | null> {
  const handle = await (window as PickerWindow).showDirectoryPicker!().catch(() => null);
  return handle ? snapshotOf(handle.name, await walked(handle)) : null;
}

export async function listedFolder(list: FileList | null): Promise<Snapshot | null> {
  const files = [...(list ?? [])];
  const name = files[0]?.webkitRelativePath.split('/')[0];
  if (!name) {
    return null;
  }
  return snapshotOf(name, files.map((f) => fromFile(f.webkitRelativePath.split('/').slice(1).join('/'), f)));
}
