import type { Component } from 'svelte';
import { GuideId } from '..';
import ChangesMock from './ChangesMock.svelte';
import LibraryMock from './LibraryMock.svelte';
import PropertiesMock from './PropertiesMock.svelte';
import ThemesMock from './ThemesMock.svelte';
import { Anchor, Menu, Snap, Subject } from './subjects';

export type MockEntry = {
  readonly component: Component<any>;
  readonly props: Record<string, unknown>;
  readonly anchor: Anchor;
  readonly focus: { readonly x: number; readonly y: number };
  readonly zoom: { readonly desktop: number; readonly phone: number };
};

const PANEL_ZOOM = { desktop: 1.8, phone: 1.25 } as const;

export const MOCKS: Readonly<Record<GuideId, MockEntry>> = {
  [GuideId.States]: { component: PropertiesMock, props: { menu: Menu.State }, anchor: Anchor.Focus, focus: { x: 150, y: 352 }, zoom: PANEL_ZOOM },
  [GuideId.Breakpoints]: { component: PropertiesMock, props: { menu: Menu.Breakpoint }, anchor: Anchor.Focus, focus: { x: 110, y: 236 }, zoom: PANEL_ZOOM },
  [GuideId.Shared]: { component: PropertiesMock, props: {}, anchor: Anchor.Focus, focus: { x: 150, y: 205 }, zoom: PANEL_ZOOM },
  [GuideId.Snap]: { component: PropertiesMock, props: { snap: Snap.Demo }, anchor: Anchor.Focus, focus: { x: 150, y: 435 }, zoom: PANEL_ZOOM },
  [GuideId.Themes]: { component: ThemesMock, props: {}, anchor: Anchor.TopRight, focus: { x: 0, y: 0 }, zoom: { desktop: 1.15, phone: 0.9 } },
  [GuideId.Attributes]: { component: PropertiesMock, props: { subject: Subject.Image }, anchor: Anchor.Focus, focus: { x: 150, y: 980 }, zoom: PANEL_ZOOM },
  [GuideId.Library]: { component: LibraryMock, props: {}, anchor: Anchor.Focus, focus: { x: 130, y: 125 }, zoom: { desktop: 2.1, phone: 1.5 } },
  [GuideId.Changes]: { component: ChangesMock, props: {}, anchor: Anchor.Focus, focus: { x: 150, y: 100 }, zoom: PANEL_ZOOM }
};
