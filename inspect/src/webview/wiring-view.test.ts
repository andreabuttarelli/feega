import { describe, expect, it } from 'vitest';
import { Go } from '@feega/live-edit/go-action';
import type { Wiring } from '../messages';
import { canAddGo, GO_CHOICES, handlerLabel, routeChoices } from './wiring-view';

const AT = { file: 'src/A.tsx', line: 3, col: 5 };
const CLICK = { attribute: 'onClick', event: 'click', handler: null, at: AT };
const HOVER = { attribute: 'onMouseEnter', event: 'mouseenter', handler: 'hover', at: AT };
const LINK = { tag: 'a', attr: 'href', value: '/a', editable: true, newTab: false, tabEditable: true };

const wiring = (over: Partial<Wiring>): Wiring => ({ link: null, events: [], routes: [], ...over });

describe('canAddGo', () => {
  it('offers actions to an element with no link and no click handler', () => {
    expect(canAddGo(wiring({ events: [HOVER] }))).toBe(true);
  });

  it('does not offer them to a link', () => {
    expect(canAddGo(wiring({ link: LINK }))).toBe(false);
  });

  it('does not offer them when click is handled', () => {
    expect(canAddGo(wiring({ events: [CLICK] }))).toBe(false);
  });
});

describe('labels', () => {
  it('names a handler or says inline', () => {
    expect(handlerLabel(HOVER)).toBe('hover');
    expect(handlerLabel(CLICK)).toBe('inline');
  });

  it('has one choice per action', () => {
    expect(GO_CHOICES.map((c) => c.go)).toEqual([Go.Page, Go.Url, Go.Section]);
  });

  it('suggests routes only for the page action', () => {
    expect(routeChoices(Go.Page, ['/a'])).toEqual(['/a']);
    expect(routeChoices(Go.Url, ['/a'])).toEqual([]);
  });
});
