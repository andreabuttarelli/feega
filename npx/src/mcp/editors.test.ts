import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { childEditors, editorUrlOf } from './editors';

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  killed = false;
  kill() {
    this.killed = true;
    this.emit('exit');
    return true;
  }
}

const harness = () => {
  const children: FakeChild[] = [];
  const argv: string[][] = [];
  const editors = childEditors('/dist/cli.cjs', (_command, args) => {
    const child = new FakeChild();
    children.push(child);
    argv.push(args);
    return child as unknown as ChildProcess;
  });
  return { editors, children, argv };
};

describe('background editors', () => {
  it('reads the url from the ready line', () => {
    expect(editorUrlOf('feega: editor ready on http://127.0.0.1:4100/  (Ctrl+C to stop)')).toBe('http://127.0.0.1:4100/');
    expect(editorUrlOf('feega: starting its dev server…')).toBeNull();
  });

  it('starts the same server as npx feega --no-open and resolves when it is ready', async () => {
    const { editors, children, argv } = harness();

    const ready = editors.ensure('/work/shop');
    children[0].stdout.emit('data', Buffer.from('feega: editing /work/shop\n'));
    children[0].stdout.emit('data', Buffer.from('feega: editor ready on http://127.0.0.1:4100/  (Ctrl+C to stop)\n'));

    expect(await ready).toEqual({ url: 'http://127.0.0.1:4100/' });
    expect(argv[0]).toEqual(['/dist/cli.cjs', '/work/shop', '--no-open']);
  });

  it('keeps one editor per folder while the session is open', async () => {
    const { editors, children } = harness();

    const first = editors.ensure('/work/shop');
    const second = editors.ensure('/work/shop');
    children[0].stdout.emit('data', Buffer.from('editor ready on http://127.0.0.1:4100/\n'));

    expect(await first).toEqual(await second);
    expect(children).toHaveLength(1);
  });

  it('kills the editor on release', async () => {
    const { editors, children } = harness();
    const ready = editors.ensure('/work/shop');
    children[0].stdout.emit('data', Buffer.from('editor ready on http://127.0.0.1:4100/\n'));
    await ready;

    await editors.release('/work/shop');

    expect(children[0].killed).toBe(true);
  });

  it('fails clearly when the editor exits before it is ready', async () => {
    const { editors, children } = harness();

    const ready = editors.ensure('/work/shop');
    children[0].stdout.emit('data', Buffer.from('feega: no web app (package.json) in /work/shop\n'));
    children[0].emit('exit');

    await expect(ready).rejects.toThrow('no web app');
  });
});
