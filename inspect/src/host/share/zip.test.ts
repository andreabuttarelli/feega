import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { crc32, zipOf } from './zip';

const text = (value: string) => new TextEncoder().encode(value);

describe('zip', () => {
  it('computes the standard crc32', () => {
    expect(crc32(text('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('writes an archive that unzip reads back', () => {
    const dir = mkdtempSync(join(tmpdir(), 'feega-zip-'));
    const archive = join(dir, 'a.zip');
    writeFileSync(archive, zipOf([{ name: 'index.html', data: text('<h1>è</h1>') }, { name: 'styles/main.css', data: text('h1{color:red}') }]));

    expect(execFileSync('unzip', ['-t', archive]).toString()).toContain('No errors detected');
    expect(execFileSync('unzip', ['-p', archive, 'index.html']).toString()).toBe('<h1>è</h1>');
    expect(execFileSync('unzip', ['-p', archive, 'styles/main.css']).toString()).toBe('h1{color:red}');
    expect(readFileSync(archive).subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 3, 4]));
  });

  it('writes an empty archive', () => {
    expect(zipOf([]).length).toBe(22);
  });
});
