import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { ActionKind, TriggerKind, type Interaction } from '@feega/motion-core/motion/prototype/model';
import { createComponent } from '$lib/motion/main-component';
import { groupClips } from '$lib/motion/group';
import { addVariant } from '$lib/motion/variants';
import { homed, placeInstance } from '$lib/motion/canvas-components';
import { changeTo, placedClips, variantChoices, variantHotspotsOf, variantSpotsOf, withSwaps } from './variant-change';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

let n = 0;
const newId = () => `x${++n}`;

const toggle = (value: string): Interaction => ({ id: `to-${value}`, trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.ChangeTo, variant: { State: value } }, transition: { kind: 'instant' } as Interaction['transition'] });

const clipsIn = (doc: MotionDoc, comp: string) => doc.comps[comp].tracks.flatMap((t) => t.clips as MotionClip[]);

function accordion() {
  const base = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'Question' } }, 'question'));
  const made = must(createComponent(base, ['question'], newId, 'Accordion'));
  const instance = made.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!;
  const closed = String(instance.props.comp);
  const withOpen = must(addVariant({ ...made, comps: { ...made.comps, [closed]: { ...made.comps[closed], component: { ...made.comps[closed].component!, set: 'Accordion', variant: { State: 'Closed' } } } } }, closed, { State: 'Open' }, newId));
  const open = Object.keys(withOpen.comps).find((id) => id !== closed)!;
  const wired = (doc: MotionDoc, comp: string, value: string): MotionDoc => ({
    ...doc,
    comps: { ...doc.comps, [comp]: { ...doc.comps[comp], tracks: doc.comps[comp].tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, interactions: [toggle(value)] })) })) } }
  });
  return { doc: wired(wired(withOpen, closed, 'Open'), open, 'Closed'), instance: instance.id, closed, open };
}

describe('change to variant on an instance placed in another frame', () => {
  it('Change to on the instance itself swaps it to the other variant of its set', () => {
    const { doc: home, closed, open } = accordion();
    const screen = must(placeInstance(newMotionDoc(MotionFormat.Landscape), homed(home, 'components'), closed, () => 'card'));
    const withClick = { ...screen, tracks: screen.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'card' ? { ...c, interactions: [toggle('Open')] } : c)) })) };

    expect(changeTo(withClick, ['card'], { State: 'Open' })).toEqual({ instance: 'card', comp: open });
  });
});

describe('change to variant in the player', () => {
  it('a click inside a closed accordion changes that instance to the open variant', () => {
    const { doc, instance, open } = accordion();

    expect(changeTo(doc, [instance, 'question'], { State: 'Open' })).toEqual({ instance, comp: open });
  });

  it('a variant the instance already shows changes nothing', () => {
    const { doc, instance } = accordion();

    expect(changeTo(doc, [instance, 'question'], { State: 'Closed' })).toBeNull();
  });

  it('a value no set member has falls through to nothing', () => {
    const { doc, instance } = accordion();

    expect(changeTo(doc, [instance, 'question'], { State: 'Half' })).toBeNull();
  });

  it('a swap shows the other variant and keeps the rest of the page', () => {
    const { doc, instance, open, closed } = accordion();
    const swapped = withSwaps(doc, { [instance]: open });

    expect(placedClips(swapped).find((p) => p.clip.id === instance)?.clip.props.comp).toBe(open);
    expect(placedClips(doc).find((p) => p.clip.id === instance)?.clip.props.comp).toBe(closed);
  });

  it('a swap reaches an instance held inside a group', () => {
    const { doc, instance, open } = accordion();
    const grouped = must(groupClips(doc, [instance], newId));
    const swapped = withSwaps(grouped, { [instance]: open });
    const group = Object.keys(grouped.comps).find((id) => !grouped.comps[id].component)!;

    expect(clipsIn(swapped, group).find((c) => c.id === instance)?.props.comp).toBe(open);
  });

  it('spots come from the variant on show, each with the path down to its clip', () => {
    const { doc, instance, open } = accordion();
    const spots = variantSpotsOf(doc);
    const after = variantSpotsOf(withSwaps(doc, { [instance]: open }));

    expect(spots.map((s) => [s.path, s.interaction.id])).toEqual([[[instance, 'question'], 'to-Open']]);
    expect(after.map((s) => s.interaction.id)).toEqual(['to-Closed']);
  });

  it('the inspector offers every variant of the set around the layer', () => {
    const { doc } = accordion();

    expect(variantChoices(doc, 'question')).toEqual([{ State: 'Closed' }, { State: 'Open' }]);
    expect(variantChoices(doc, 'nowhere')).toEqual([]);
  });

  it('a spot sits over its clip in that instance, as fractions of the frame', () => {
    const { doc, instance } = accordion();
    const spots = variantHotspotsOf(doc, { width: 1000, height: 500 }, (path) => (path[0] === instance ? { left: 100, top: 50, width: 500, height: 100 } : null));

    expect(spots.map((s) => s.box)).toEqual([{ left: 0.1, top: 0.1, width: 0.5, height: 0.2 }]);
    expect(variantHotspotsOf(doc, { width: 1000, height: 500 }, () => null)).toEqual([]);
  });
});
