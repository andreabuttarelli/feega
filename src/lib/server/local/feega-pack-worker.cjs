const { parentPort } = require('node:worker_threads');
const { closeSync, fsyncSync, openSync, writeSync } = require('node:fs');
const { crc32, deflateRawSync } = require('node:zlib');

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const STORED = 0;
const DEFLATED = 8;
const UTF8_NAMES = 0x800;
const ZIP_VERSION = 20;
const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL = 0x06054b50;

function dosTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function localHeader(entry, stamp) {
  const name = Buffer.from(entry.name, 'utf8');
  const head = Buffer.alloc(30);
  head.writeUInt32LE(LOCAL_HEADER, 0);
  head.writeUInt16LE(ZIP_VERSION, 4);
  head.writeUInt16LE(UTF8_NAMES, 6);
  head.writeUInt16LE(entry.method, 8);
  head.writeUInt16LE(stamp.time, 10);
  head.writeUInt16LE(stamp.day, 12);
  head.writeUInt32LE(entry.crc, 14);
  head.writeUInt32LE(entry.data.byteLength, 18);
  head.writeUInt32LE(entry.size, 22);
  head.writeUInt16LE(name.byteLength, 26);
  return Buffer.concat([head, name]);
}

function centralHeader(entry, stamp, offset) {
  const name = Buffer.from(entry.name, 'utf8');
  const head = Buffer.alloc(46);
  head.writeUInt32LE(CENTRAL_HEADER, 0);
  head.writeUInt16LE(ZIP_VERSION, 4);
  head.writeUInt16LE(ZIP_VERSION, 6);
  head.writeUInt16LE(UTF8_NAMES, 8);
  head.writeUInt16LE(entry.method, 10);
  head.writeUInt16LE(stamp.time, 12);
  head.writeUInt16LE(stamp.day, 14);
  head.writeUInt32LE(entry.crc, 16);
  head.writeUInt32LE(entry.data.byteLength, 20);
  head.writeUInt32LE(entry.size, 24);
  head.writeUInt16LE(name.byteLength, 28);
  head.writeUInt32LE(offset, 42);
  return Buffer.concat([head, name]);
}

function endOfCentral(count, size, offset) {
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_OF_CENTRAL, 0);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  return end;
}

function deflated(name, text) {
  const raw = Buffer.from(text, 'utf8');
  return { name, method: DEFLATED, crc: crc32(raw), size: raw.byteLength, data: deflateRawSync(raw) };
}

function writeZip(path, entries) {
  const stamp = dosTime(new Date());
  const fd = openSync(path, 'w');
  try {
    let offset = 0;
    const central = [];
    for (const entry of entries) {
      central.push(centralHeader(entry, stamp, offset));
      offset += writeSync(fd, localHeader(entry, stamp));
      offset += writeSync(fd, entry.data);
    }
    const directory = Buffer.concat(central);
    writeSync(fd, directory);
    writeSync(fd, endOfCentral(entries.length, directory.byteLength, offset));
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function pack({ path, manifest, body, assets }) {
  const ids = new Set((body.match(UUID) ?? []).map((id) => id.toLowerCase()));
  const kept = assets.filter((a) => a.always || ids.has(String(a.row.id).toLowerCase()));
  const hashed = [];
  const media = kept.flatMap((a) => {
    if (!a.row.file || !a.bytes) {
      return [];
    }
    const crc = a.crc ?? crc32(a.bytes);
    if (a.crc === undefined) {
      hashed.push(a.row.file);
    }
    return [{ name: a.row.file, method: STORED, crc, size: a.bytes.byteLength, data: a.bytes }];
  });
  const canvas = `${body.slice(0, -1)},"assets":${JSON.stringify(kept.map((a) => a.row))}}`;
  writeZip(path, [deflated('manifest.json', manifest), deflated('canvas.json', canvas), ...media]);
  return { hashed: media.filter((m) => hashed.includes(m.name)).map((m) => [m.name, m.crc]) };
}

parentPort.on('message', (job) => {
  try {
    parentPort.postMessage({ id: job.id, ok: true, ...pack(job) });
  } catch (error) {
    parentPort.postMessage({ id: job.id, ok: false, error: String(error) });
  }
});
