import { describe, expect, it } from 'vitest';
import { Failure, failureOf, localUrlOf } from './dev-output';

describe('the url a dev server prints', () => {
  it('reads Vite past colours and the arrow', () => {
    expect(localUrlOf('  \u001b[32m➜\u001b[39m  \u001b[1mLocal\u001b[22m:   \u001b[36mhttp://127.0.0.1:\u001b[1m61724\u001b[22m/\u001b[39m\n')).toBe('http://127.0.0.1:61724/');
  });

  it('reads Next and Astro', () => {
    expect(localUrlOf('   - Local:        http://localhost:3000')).toBe('http://localhost:3000');
    expect(localUrlOf('┃ Local    http://localhost:4321/')).toBe('http://localhost:4321/');
  });

  it('ignores other lines', () => {
    expect(localUrlOf('ready in 300 ms')).toBeNull();
  });
});

describe('a dev server that cannot start says why', () => {
  it.each([
    ['sh: astro: command not found', Failure.MissingDeps],
    ["'vite' is not recognized as an internal or external command", Failure.MissingDeps],
    ['Error: listen EADDRINUSE: address already in use 127.0.0.1:5173', Failure.PortInUse],
    ["Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vite' imported from x", Failure.MissingModule],
    ["Error: Cannot find module '@sveltejs/kit'", Failure.MissingModule],
    ['SyntaxError: Unexpected token }', Failure.Syntax]
  ])('%s', (line, failure) => {
    expect(failureOf(line)?.failure).toBe(failure);
  });

  it('keeps the line it matched', () => {
    expect(failureOf('noise\nsh: astro: command not found\n')?.line).toBe('sh: astro: command not found');
  });

  it('normal output is no failure', () => {
    expect(failureOf('VITE v6 ready in 412 ms')).toBeNull();
  });
});
