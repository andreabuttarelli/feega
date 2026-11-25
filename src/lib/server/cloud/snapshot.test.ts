import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { snapshotEntryName, snapshotFile, SNAPSHOT_CSP } from './snapshot';
import { fakeDb } from './testing/fake-db';
import { indexZip, readEntry } from './zip';

type Member = { name: string; content: string; deflate: boolean };

function buildZip(members: Member[]): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const member of members) {
    const name = Buffer.from(member.name);
    const raw = Buffer.from(member.content);
    const data = member.deflate ? deflateRawSync(raw) : raw;
    const method = member.deflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + data.length;
  }

  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(members.length, 8);
  end.writeUInt16LE(members.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);

  return new Uint8Array(Buffer.concat([...locals, centralBytes, end]));
}

const ARCHIVE = buildZip([
  { name: 'index.html', content: '<h1>Hello</h1>'.repeat(20), deflate: true },
  { name: 'assets/site.css', content: 'h1{color:red}', deflate: false }
]);

describe('zip reader', () => {
  it('reads deflated and stored entries', async () => {
    const index = indexZip(ARCHIVE);

    expect(new TextDecoder().decode((await readEntry(ARCHIVE, index, 'index.html'))!)).toBe('<h1>Hello</h1>'.repeat(20));
    expect(new TextDecoder().decode((await readEntry(ARCHIVE, index, 'assets/site.css'))!)).toBe('h1{color:red}');
  });

  it('returns null for a name that is not in the archive', async () => {
    expect(await readEntry(ARCHIVE, indexZip(ARCHIVE), '../etc/passwd')).toBeNull();
  });

  it('refuses bytes that are not a zip', () => {
    expect(() => indexZip(new Uint8Array(64))).toThrow('zip');
  });
});

describe('snapshotEntryName', () => {
  it('defaults to index.html and drops leading slashes', () => {
    expect(snapshotEntryName('')).toBe('index.html');
    expect(snapshotEntryName('/assets/site.css')).toBe('assets/site.css');
  });
});

describe('snapshotFile', () => {
  function dbWith(snapshotPath: string | null) {
    const db = fakeDb({ share_sessions: [{ id: 'abcdefghij', org_id: 'org-1', snapshot_path: snapshotPath }] });
    (db as unknown as { storage: unknown }).storage = {
      from: () => ({ download: async () => ({ data: new Blob([ARCHIVE as BlobPart]), error: null }) })
    };

    return db;
  }

  it('serves a file of the stored snapshot with its content type', async () => {
    const file = await snapshotFile(dbWith('org-1/abcdefghij.zip'), 'abcdefghij', 'assets/site.css');

    expect(file?.contentType).toBe('text/css; charset=utf-8');
    expect(new TextDecoder().decode(file!.body)).toBe('h1{color:red}');
  });

  it('serves a named version from its own object', async () => {
    const db = fakeDb({ share_sessions: [{ id: 'abcdefghij', org_id: 'org-1', snapshot_path: null }] });
    const asked: string[] = [];
    (db as unknown as { storage: unknown }).storage = {
      from: () => ({ download: async (path: string) => (asked.push(path), { data: new Blob([ARCHIVE as BlobPart]), error: null }) })
    };

    const file = await snapshotFile(db, 'abcdefghij', 'v/before-abc123/index.html');

    expect(asked).toEqual(['org-1/abcdefghij/versions/before-abc123.zip']);
    expect(file?.contentType).toBe('text/html; charset=utf-8');
  });

  it('is null when the session saved no snapshot or the file is missing', async () => {
    expect(await snapshotFile(dbWith(null), 'abcdefghij', 'index.html')).toBeNull();
    expect(await snapshotFile(dbWith('org-1/abcdefghij.zip'), 'abcdefghij', 'nope.js')).toBeNull();
  });

  it('forbids scripts and navigation in what it serves', () => {
    expect(SNAPSHOT_CSP).toContain('sandbox');
    expect(SNAPSHOT_CSP).toContain("default-src 'none'");
    expect(SNAPSHOT_CSP).not.toContain('script-src');
  });
});
