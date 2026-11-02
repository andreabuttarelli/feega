import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { createComponent } from '$lib/motion/main-component';
import InstanceInspector from './InstanceInspector.svelte';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

let n = 0;
const newId = () => `id${++n}`;

function made(home: string | null) {
  const box = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, props: { shape: 'rect' } }, 'bg'));
  const doc = must(createComponent(box, ['bg'], newId, 'Button'));
  const homed = home ? { ...doc, comps: Object.fromEntries(Object.entries(doc.comps).map(([k, c]) => [k, c.component ? { ...c, component: { ...c.component, home } } : c])) } : doc;
  const id = homed.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!.id;
  return { doc: homed, id };
}

const html = (home: string | null, here: string) => {
  const { doc, id } = made(home);
  return render(InstanceInspector, { props: { doc, clipId: id, here, onchange: () => {}, onrun: () => {} } }).body;
};

describe('the component panel', () => {
  it('on the main: no swap, reset, push or detach', () => {
    const body = html('frame-a', 'frame-a');
    expect(body).toContain('data-testid="main-component-role"');
    for (const id of ['instance-swap', 'instance-reset', 'instance-push', 'instance-detach', 'instance-go-main']) {
      expect(body).not.toContain(`data-testid="${id}"`);
    }
    expect(body).toContain('data-testid="instance-add-variant"');
  });

  it('on an instance elsewhere: swap, reset, push and detach', () => {
    const body = html('frame-a', 'frame-b');
    for (const id of ['instance-swap', 'instance-reset', 'instance-push', 'instance-detach']) {
      expect(body).toContain(`data-testid="${id}"`);
    }
  });
});
