// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { INPUT_MESSAGE } from '../interactive/runtime';
import { installEngine, testTimeline } from '../engine/testing';
import { ERRORS, REGISTRY, bootScript, definitionScript, seedOf, type CustomRun } from './runtime';

const BRAND = { name: 'feega', colors: {}, logoUrl: null };
const PROBE = 'tl.to({}, { duration: 2, ease: "none", onUpdate: () => { root.dataset.seen = props.label + "|" + props.fontSize; } }, 0);';

function bound(vars: Record<string, string | number | boolean>) {
  document.body.innerHTML = `<div id="cc-c1"></div>`;
  const w = window as unknown as Record<string, unknown>;
  const master = testTimeline(installEngine());
  w.__master = master;
  const runs: CustomRun[] = [{ id: 'c1', name: 'Card', start: 0, length: 2, fps: 30, values: { varPrefix: 'card', label: 'Hi', fontSize: 12 }, seed: seedOf('c1') }];
  window.eval(definitionScript('Card', PROBE).replace(/^<script>|<\/script>$/g, ''));
  window.eval(bootScript(runs, { assets: {}, brand: BRAND, vars }, 'window.__master'));
  return { master, root: document.getElementById('cc-c1')! };
}

afterEach(() => {
  const w = window as unknown as Record<string, unknown>;
  delete w[REGISTRY];
  delete w[ERRORS];
});

describe('a component that names a varPrefix', () => {
  it('reads each prop from the variable <prefix>_<snake_prop> when one is declared', () => {
    const { master, root } = bound({ card_label: 'Hello', card_font_size: 20, other_label: 'no' });

    master.seek(1);

    expect(root.dataset.seen).toBe('Hello|20');
  });

  it('keeps the prop where no variable is declared', () => {
    const { master, root } = bound({});

    master.seek(1);

    expect(root.dataset.seen).toBe('Hi|12');
  });

  it('follows what the host sends while seeked, without a live run', () => {
    const { master, root } = bound({ card_label: 'Hello' });

    window.dispatchEvent(new MessageEvent('message', { data: { type: INPUT_MESSAGE, values: {}, vars: { card_label: 'Live' } } }));
    master.seek(0.5);

    expect(root.dataset.seen).toBe('Live|12');
  });
});
