import { describe, expect, it } from 'vitest';
import { RestartWatch, Signal, Step } from './restart-watch';

const MINUTE_MS = 60_000;

describe('RestartWatch', () => {
  it('a server that keeps answering needs nothing', () => {
    const watch = new RestartWatch();

    expect(watch.feed(Signal.Alive, 0)).toBe(Step.None);
    expect(watch.feed(Signal.Alive, 300)).toBe(Step.None);
  });

  it('a server that goes quiet shows the restarting state once', () => {
    const watch = new RestartWatch();

    expect(watch.feed(Signal.Lost, 0)).toBe(Step.Restarting);
    expect(watch.feed(Signal.Lost, 300)).toBe(Step.None);
  });

  it('the page reloads when the server answers again', () => {
    const watch = new RestartWatch();
    watch.feed(Signal.Lost, 0);

    expect(watch.feed(Signal.Alive, 900)).toBe(Step.Reload);
    expect(watch.feed(Signal.Alive, 1200)).toBe(Step.None);
  });

  it('a closed hot-reload socket on a server that answers still reloads', () => {
    const watch = new RestartWatch();

    expect(watch.feed(Signal.Lost, 0)).toBe(Step.Restarting);
    expect(watch.feed(Signal.Alive, 50)).toBe(Step.Reload);
  });

  it('a dead process is restarted by Feega', () => {
    const watch = new RestartWatch();

    expect(watch.feed(Signal.Exited, 0)).toBe(Step.Respawn);
  });

  it('after the respawn the page reloads once the new server answers', () => {
    const watch = new RestartWatch();
    watch.feed(Signal.Exited, 0);

    expect(watch.feed(Signal.Alive, 4000)).toBe(Step.Reload);
  });

  it('a server that keeps dying is given up on', () => {
    const watch = new RestartWatch();
    watch.feed(Signal.Exited, 0);
    watch.feed(Signal.Exited, 1000);
    watch.feed(Signal.Exited, 2000);

    expect(watch.feed(Signal.Exited, 3000)).toBe(Step.GiveUp);
  });

  it('old crashes are forgotten', () => {
    const watch = new RestartWatch();
    watch.feed(Signal.Exited, 0);
    watch.feed(Signal.Exited, 1000);
    watch.feed(Signal.Exited, 2000);

    expect(watch.feed(Signal.Exited, 2 * MINUTE_MS)).toBe(Step.Respawn);
  });
});
