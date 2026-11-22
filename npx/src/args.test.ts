import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Browser, Run, argsOf } from './args';

describe('npx feega arguments', () => {
  it('no argument opens the current folder on a free port in the browser', () => {
    expect(argsOf([], resolve('/work'))).toEqual({ run: Run.Editor, dir: resolve('/work'), port: 0, browser: Browser.Open });
  });

  it('a folder, a port and --no-open', () => {
    expect(argsOf(['landing', '--port', '4100', '--no-open'], resolve('/work'))).toEqual({ run: Run.Editor, dir: resolve('/work', 'landing'), port: 4100, browser: Browser.Stay });
  });

  it('--port=N and an absolute folder', () => {
    expect(argsOf(['--port=4100', '/abs/app'], resolve('/work'))).toMatchObject({ dir: resolve('/abs/app'), port: 4100 });
  });

  it('--url takes the address of a running dev server, as a folder may follow', () => {
    expect(argsOf(['--url', 'localhost:5173', 'web'], resolve('/work'))).toEqual({ run: Run.Editor, dir: resolve('/work', 'web'), port: 0, browser: Browser.Open, url: 'http://localhost:5173' });
    expect(argsOf(['--url=http://127.0.0.1:3000/x'], resolve('/work'))).toMatchObject({ url: 'http://127.0.0.1:3000' });
  });

  it('--url needs a web address', () => {
    expect(argsOf(['--url', 'nope nope'], '/w')).toEqual({ run: Run.Error, reason: 'the --url must be a web address like http://localhost:5173' });
    expect(argsOf(['--url'], '/w')).toMatchObject({ run: Run.Error });
  });

  it('--help and --version', () => {
    expect(argsOf(['--help'], '/w').run).toBe(Run.Help);
    expect(argsOf(['-h'], '/w').run).toBe(Run.Help);
    expect(argsOf(['--version'], '/w').run).toBe(Run.Version);
  });

  it('an unknown flag or a bad port is an error', () => {
    expect(argsOf(['--nope'], '/w')).toEqual({ run: Run.Error, reason: 'unknown option --nope' });
    expect(argsOf(['--port', 'x'], '/w')).toEqual({ run: Run.Error, reason: 'the port must be a number' });
  });

  it('the mcp command serves the Cloud tools over stdio', () => {
    expect(argsOf(['mcp'], '/w')).toEqual({ run: Run.Mcp });
  });

  it('a folder named mcp is still a folder after a flag', () => {
    expect(argsOf(['--no-open', 'mcp'], resolve('/w'))).toMatchObject({ run: Run.Editor, dir: resolve('/w', 'mcp') });
  });
});
