import { describe, expect, it } from 'vitest';
import { COMPILING_FIRST_PAGE, phaseFeed, phaseOfLine } from './dev-phase';

describe('the phase a dev server line reports', () => {
  it.each([
    ['11:00:07 PM [vite] (client) Forced re-optimization of dependencies', 'Optimizing dependencies…'],
    ['[vite] (client) Re-optimizing dependencies because vite config has changed', 'Optimizing dependencies…'],
    ['\u001b[32m✔\u001b[39m [paraglide-js] Compilation complete (locale-modules)', 'Compiling translations…']
  ])('%s', (line, phase) => {
    expect(phaseOfLine(line)).toBe(phase);
  });

  it('is silent on lines that change nothing', () => {
    expect(phaseOfLine('  ➜  Local:   http://127.0.0.1:5199/')).toBeNull();
  });

  it('names the wait that follows a ready server', () => {
    expect(COMPILING_FIRST_PAGE).toBe('Compiling the first page…');
  });
});

describe('the phase feed', () => {
  const feedOf = () => {
    const posted: (string | null)[] = [];
    return { posted, feed: phaseFeed((text) => posted.push(text)) };
  };

  it('posts a phase from a log line while a start is in progress', () => {
    const { posted, feed } = feedOf();

    feed.begin();
    feed.line('[vite] (client) Forced re-optimization of dependencies');

    expect(posted).toEqual(['Optimizing dependencies…']);
  });

  it('does not repeat the phase it just posted', () => {
    const { posted, feed } = feedOf();

    feed.begin();
    feed.line('Forced re-optimization of dependencies');
    feed.line('Re-optimizing dependencies');

    expect(posted).toEqual(['Optimizing dependencies…']);
  });

  it('ignores log lines once the preview is ready', () => {
    const { posted, feed } = feedOf();

    feed.begin();
    feed.show(COMPILING_FIRST_PAGE);
    feed.finish();
    feed.line('Forced re-optimization of dependencies');

    expect(posted).toEqual([COMPILING_FIRST_PAGE, null]);
  });

  it('names the first page wait when the server is ready', () => {
    const { posted, feed } = feedOf();

    feed.begin();
    feed.show(COMPILING_FIRST_PAGE);

    expect(posted).toEqual([COMPILING_FIRST_PAGE]);
  });
});
