import { describe, expect, it } from 'vitest';
import { Chrome, FocusControl, HostKind, Presentation, VIEWS, ViewKind, barControlsOf, chromeOf, presentationOf, shellTabsOf, rowTabsOf, shellTitleOf, tabsOf } from './views';

const NONE = { focus: null, pages: false, components: false };

describe('the view registry', () => {
  it('describes every view with a title, an icon and whether it closes', () => {
    for (const kind of Object.values(ViewKind)) {
      expect(VIEWS[kind].icon).toBeTruthy();
      expect(VIEWS[kind].title('Card')).toBeTruthy();
    }
  });

  it('never closes the editor', () => {
    expect(VIEWS[ViewKind.Editor].closable).toBe(false);
  });

  it('titles a focus view after its component', () => {
    expect(VIEWS[ViewKind.Focus].title('Card')).toBe('Card');
  });
});

describe('tabsOf', () => {
  it('is only the editor when nothing else is open', () => {
    expect(tabsOf(NONE, ViewKind.Editor).map((t) => t.kind)).toEqual([ViewKind.Editor]);
  });

  it('adds the canvas and the focus after the editor, in that order', () => {
    expect(tabsOf({ focus: 'Card', pages: true, components: false }, ViewKind.Editor).map((t) => t.kind)).toEqual([ViewKind.Editor, ViewKind.PagesCanvas, ViewKind.Focus]);
  });

  it('lists the components canvas between the pages canvas and the focus', () => {
    expect(tabsOf({ focus: 'Card', pages: true, components: true }, ViewKind.Editor).map((t) => t.kind)).toEqual([ViewKind.Editor, ViewKind.PagesCanvas, ViewKind.ComponentsCanvas, ViewKind.Focus]);
  });

  it('titles the components canvas', () => {
    const tab = tabsOf({ focus: null, pages: false, components: true }, ViewKind.ComponentsCanvas)[1];
    expect(tab).toMatchObject({ title: 'Components canvas', closable: true, active: true });
  });

  it('marks exactly the shown view as active', () => {
    const tabs = tabsOf({ focus: 'Card', pages: true, components: false }, ViewKind.Focus);
    expect(tabs.filter((t) => t.active).map((t) => t.kind)).toEqual([ViewKind.Focus]);
  });

  it('carries the title and closable flag of the registry', () => {
    const focus = tabsOf({ focus: 'Card', pages: false, components: false }, ViewKind.Focus).find((t) => t.kind === ViewKind.Focus);
    expect(focus).toMatchObject({ title: 'Card', closable: true });
  });
});

describe('presentationOf', () => {
  it('draws a tab row above the editor in the browser', () => {
    expect(presentationOf(HostKind.Browser)).toBe(Presentation.TopRow);
  });

  it('hands the tabs to the window of the desktop app', () => {
    expect(presentationOf(HostKind.Desktop)).toBe(Presentation.ShellTabs);
  });

  it('draws a tab row above the editor in VS Code until each view gets its own panel', () => {
    expect(presentationOf(HostKind.VsCode)).toBe(Presentation.TopRow);
  });
});

describe('rowTabsOf', () => {
  it('names the first tab after the project, like the desktop window', () => {
    const tabs = tabsOf({ focus: 'Card', pages: true, components: false }, ViewKind.Editor);
    expect(rowTabsOf('react-css', tabs).map((t) => t.title)).toEqual(['react-css', 'Pages canvas', 'Card']);
  });

  it('is one tab for a project with nothing else open', () => {
    expect(rowTabsOf('react-css', tabsOf(NONE, ViewKind.Editor))).toHaveLength(1);
  });

  it('keeps the active flag and the closable flag', () => {
    const tabs = rowTabsOf('react-css', tabsOf({ focus: 'Card', pages: false, components: false }, ViewKind.Focus));
    expect(tabs.map((t) => [t.active, t.closable])).toEqual([[false, false], [true, true]]);
  });
});

describe('shell tabs', () => {
  it('leaves the editor to the project tab', () => {
    const tabs = tabsOf({ focus: 'Card', pages: true, components: false }, ViewKind.Editor);
    expect(shellTabsOf(tabs).map((t) => t.id)).toEqual([ViewKind.PagesCanvas, ViewKind.Focus]);
  });

  it('names a view after its project', () => {
    expect(shellTitleOf('traidue.com', 'Pages canvas')).toBe('traidue.com · Pages canvas');
  });
});

describe('barControlsOf', () => {
  it('puts zoom, scheme and the transparent canvas on the bottom bar of a focus view', () => {
    expect(barControlsOf(ViewKind.Focus)).toEqual([FocusControl.Zoom, FocusControl.Scheme, FocusControl.Transparent]);
  });

  it.each([ViewKind.Editor, ViewKind.PagesCanvas, ViewKind.ComponentsCanvas])('adds nothing to the bottom bar of %s', (kind) => {
    expect(barControlsOf(kind)).toEqual([]);
  });
});

describe('chromeOf', () => {
  it.each([ViewKind.PagesCanvas, ViewKind.ComponentsCanvas])('leaves only the canvas in %s', (kind) => {
    expect(chromeOf(kind)).toBe(Chrome.Bare);
  });

  it.each([ViewKind.Editor, ViewKind.Focus])('keeps every panel in %s', (kind) => {
    expect(chromeOf(kind)).toBe(Chrome.Full);
  });

  it('says it for every view', () => {
    for (const kind of Object.values(ViewKind)) {
      expect(Object.values(Chrome)).toContain(VIEWS[kind].chrome);
    }
  });
});
