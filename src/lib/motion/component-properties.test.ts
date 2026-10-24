// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { newMotionDoc, MotionFormat, type MotionClip, type MotionDoc } from './doc';
import { addClip, type OpResult } from './timeline';
import { flattenComps } from './precomp';
import { createComponent, instanceOf } from './main-component';
import { defineProperty, removeProperty, resetProperty, setProperty } from './component-properties';
import { PropertyKind } from './property-resolve';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

let n = 0;
const newId = () => `id${++n}`;

const hostOf = (doc: MotionDoc, comp?: string) => doc.tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => c.component === 'Precomp' && (!comp || c.props.comp === comp));

function buttonDoc() {
  const withBox = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect' } }, 'bg'));
  const withIcon = must(addClip(withBox, { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'ellipse' } }, 'icon'));
  const withText = must(addClip(withIcon, { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'Buy now' } }, 'label'));
  const doc = must(createComponent(withText, ['bg', 'icon', 'label'], newId, 'Button'));
  const host = hostOf(doc)[0];
  return { doc, instance: host.id, compId: String(host.props.comp) };
}

const flat = (doc: MotionDoc) => flattenComps(doc).tracks.flatMap((t) => t.clips as MotionClip[]);
const hasIcon = (doc: MotionDoc) => flat(doc).some((c) => c.id.endsWith('__icon'));
const texts = (doc: MotionDoc) => flat(doc).filter((c) => c.component === 'Text').map((c) => c.props.text);

describe('component properties', () => {
  it('a boolean property hides its layer in the instance that turns it off', () => {
    const { doc, instance, compId } = buttonDoc();
    const defined = must(defineProperty(doc, compId, 'Show icon', { kind: PropertyKind.Boolean, target: 'icon', default: true }));
    expect(hasIcon(defined)).toBe(true);

    expect(hasIcon(must(setProperty(defined, instance, 'Show icon', false)))).toBe(false);
  });

  it('a text property sets the label and resetting returns the default', () => {
    const { doc, instance, compId } = buttonDoc();
    const defined = must(defineProperty(doc, compId, 'Label', { kind: PropertyKind.Text, target: 'label', default: 'Buy now' }));
    const set = must(setProperty(defined, instance, 'Label', 'Sold out'));

    expect(texts(set)).toEqual(['Sold out']);
    expect(texts(must(resetProperty(set, instance, 'Label')))).toEqual(['Buy now']);
  });

  it('an instance-swap property replaces the nested instance with another component', () => {
    const { doc, compId } = buttonDoc();
    const withTag = must(addClip(doc, { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'Tag' } }, 'tag'));
    const tagged = must(createComponent(withTag, ['tag'], newId, 'Tag'));
    const tagComp = String(hostOf(tagged).find((c) => c.props.comp !== compId)!.props.comp);
    const nested = hostOf(tagged, compId)[0];
    const card = must(createComponent(tagged, [nested.id], newId, 'Card'));
    const cardComp = String(hostOf(card).find((c) => c.props.comp !== tagComp)!.props.comp);
    const cardInstance = hostOf(card, cardComp)[0];

    const defined = must(defineProperty(card, cardComp, 'Content', { kind: PropertyKind.Swap, target: nested.id, default: compId }));
    expect(texts(defined)).toContain('Buy now');
    expect(texts(must(setProperty(defined, cardInstance.id, 'Content', tagComp)))).not.toContain('Buy now');
    expect(texts(must(setProperty(defined, cardInstance.id, 'Content', tagComp)))).toContain('Tag');
  });

  it('a nested instance property is exposed on the top instance', () => {
    const { doc, compId } = buttonDoc();
    const defined = must(defineProperty(doc, compId, 'Label', { kind: PropertyKind.Text, target: 'label', default: 'Buy now' }));
    const nested = hostOf(defined)[0];
    const card = must(createComponent(defined, [nested.id], newId, 'Card'));
    const cardComp = String(hostOf(card)[0].props.comp);
    const top = hostOf(card, cardComp)[0];

    const exposed = must(defineProperty(card, cardComp, 'Button label', { kind: PropertyKind.Nested, target: nested.id, nested: 'Label' }));
    expect(texts(must(setProperty(exposed, top.id, 'Button label', 'Go')))).toEqual(['Go']);
  });

  it('refuses a nested property the nested component does not define', () => {
    const { doc, compId } = buttonDoc();
    const nested = hostOf(doc)[0];
    const card = must(createComponent(doc, [nested.id], newId, 'Card'));
    const cardComp = String(hostOf(card)[0].props.comp);
    expect(defineProperty(card, cardComp, 'X', { kind: PropertyKind.Nested, target: nested.id, nested: 'Missing' }).ok).toBe(false);
    expect(compId).toBeTruthy();
  });

  it('refuses a property whose target the main does not have', () => {
    const { doc, compId } = buttonDoc();
    expect(defineProperty(doc, compId, 'X', { kind: PropertyKind.Boolean, target: 'nope' }).ok).toBe(false);
  });

  it('refuses a text property on a layer without text', () => {
    const { doc, compId } = buttonDoc();
    expect(defineProperty(doc, compId, 'X', { kind: PropertyKind.Text, target: 'bg' }).ok).toBe(false);
  });

  it('refuses a value of the wrong type', () => {
    const { doc, instance, compId } = buttonDoc();
    const defined = must(defineProperty(doc, compId, 'Show icon', { kind: PropertyKind.Boolean, target: 'icon' }));
    expect(setProperty(defined, instance, 'Show icon', 'yes').ok).toBe(false);
  });

  it('removing a property returns the layer to the main', () => {
    const { doc, instance, compId } = buttonDoc();
    const defined = must(defineProperty(doc, compId, 'Show icon', { kind: PropertyKind.Boolean, target: 'icon' }));
    const off = must(setProperty(defined, instance, 'Show icon', false));
    const gone = must(removeProperty(off, compId, 'Show icon'));

    expect(hasIcon(gone)).toBe(true);
    expect(instanceOf(gone, instance)!.comp.component!.properties).toBeUndefined();
  });
});
