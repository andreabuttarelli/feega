// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXACT_SEEK, exactSeek, exactSeekScript } from './exact-seek';

type Stage = Window & { __player?: { renderSeek: (t: number, options: { exact: boolean }) => void } };

const run = () => new Function(exactSeekScript().replace(/^<script>|<\/script>$/g, ''))();
const deliver = (data: unknown) => dispatchEvent(new MessageEvent('message', { data }));

describe('the exact seek inside the preview page', () => {
  afterEach(() => {
    delete (window as Stage).__player;
  });

  it('seeks the runtime to the exact time, not the 30 fps one it rounds to', () => {
    const renderSeek = vi.fn();
    (window as Stage).__player = { renderSeek };
    run();

    deliver(exactSeek(1 / 60));

    expect(renderSeek).toHaveBeenCalledWith(1 / 60, { exact: true });
  });

  it('ignores every other message', () => {
    const renderSeek = vi.fn();
    (window as Stage).__player = { renderSeek };
    run();

    deliver({ type: 'feega:capture', time: 1 });
    deliver({ type: EXACT_SEEK, time: 'soon' });

    expect(renderSeek).not.toHaveBeenCalled();
  });
});
