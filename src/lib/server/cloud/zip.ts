const END_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const END_MIN_BYTES = 22;
const MAX_COMMENT_BYTES = 0xffff;
const STORED = 0;
const DEFLATED = 8;

type Entry = { method: number; compressedSize: number; localOffset: number };

export type ZipIndex = Map<string, Entry>;

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function endOffset(view: DataView): number {
  const lowest = Math.max(0, view.byteLength - END_MIN_BYTES - MAX_COMMENT_BYTES);

  for (let at = view.byteLength - END_MIN_BYTES; at >= lowest; at--) {
    if (view.getUint32(at, true) === END_SIGNATURE) {
      return at;
    }
  }

  throw new Error('zip: no end of central directory');
}

export function indexZip(bytes: Uint8Array): ZipIndex {
  const view = viewOf(bytes);
  const end = endOffset(view);
  const count = view.getUint16(end + 10, true);
  const index: ZipIndex = new Map();
  let at = view.getUint32(end + 16, true);

  for (let i = 0; i < count; i++) {
    if (view.getUint32(at, true) !== CENTRAL_SIGNATURE) {
      throw new Error('zip: bad central directory');
    }

    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));

    index.set(name, {
      method: view.getUint16(at + 10, true),
      compressedSize: view.getUint32(at + 20, true),
      localOffset: view.getUint32(at + 42, true)
    });
    at += 46 + nameLength + extraLength + commentLength;
  }

  return index;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));

  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readEntry(bytes: Uint8Array, index: ZipIndex, name: string): Promise<Uint8Array | null> {
  const entry = index.get(name);
  if (!entry) {
    return null;
  }

  const view = viewOf(bytes);
  if (view.getUint32(entry.localOffset, true) !== LOCAL_SIGNATURE) {
    throw new Error('zip: bad local header');
  }

  const start = entry.localOffset + 30 + view.getUint16(entry.localOffset + 26, true) + view.getUint16(entry.localOffset + 28, true);
  const data = bytes.subarray(start, start + entry.compressedSize);

  if (entry.method === STORED) {
    return data;
  }
  if (entry.method === DEFLATED) {
    return inflate(data);
  }

  throw new Error(`zip: unsupported method ${entry.method}`);
}
