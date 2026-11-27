export enum ViewKind {
  Editor = 'editor',
  PagesCanvas = 'pages-canvas',
  Focus = 'focus'
}

export enum ViewIcon {
  House = 'house',
  Grid = 'grid',
  Component = 'component'
}

export enum HostKind {
  Browser = 'browser',
  Desktop = 'desktop',
  VsCode = 'vscode'
}

export enum Presentation {
  Strip = 'strip',
  ShellTabs = 'shell-tabs'
}

export enum FocusControl {
  Zoom = 'zoom',
  Scheme = 'scheme',
  Transparent = 'transparent'
}

type ViewSpec = { title: (name: string) => string; icon: ViewIcon; closable: boolean; controls: FocusControl[] };

export const VIEWS: Record<ViewKind, ViewSpec> = {
  [ViewKind.Editor]: { title: () => 'Page', icon: ViewIcon.House, closable: false, controls: [] },
  [ViewKind.PagesCanvas]: { title: () => 'Pages canvas', icon: ViewIcon.Grid, closable: true, controls: [] },
  [ViewKind.Focus]: { title: (name) => name, icon: ViewIcon.Component, closable: true, controls: [FocusControl.Zoom, FocusControl.Scheme, FocusControl.Transparent] }
};

const PRESENTATION: Record<HostKind, Presentation> = {
  [HostKind.Browser]: Presentation.Strip,
  [HostKind.Desktop]: Presentation.ShellTabs,
  [HostKind.VsCode]: Presentation.Strip
};

export const presentationOf = (host: HostKind): Presentation => PRESENTATION[host];

export type ViewTab = { id: string; kind: ViewKind; title: string; icon: ViewIcon; closable: boolean; active: boolean };

export type OpenViews = { focus: string | null; canvas: boolean };

const tabOf = (kind: ViewKind, name: string, active: ViewKind): ViewTab => ({ id: kind, kind, title: VIEWS[kind].title(name), icon: VIEWS[kind].icon, closable: VIEWS[kind].closable, active: kind === active });

export function tabsOf(open: OpenViews, active: ViewKind): ViewTab[] {
  const tabs = [tabOf(ViewKind.Editor, '', active)];
  if (open.canvas) {
    tabs.push(tabOf(ViewKind.PagesCanvas, '', active));
  }
  if (open.focus !== null) {
    tabs.push(tabOf(ViewKind.Focus, open.focus, active));
  }
  return tabs;
}

export const shellTabsOf = (tabs: ViewTab[]): ViewTab[] => tabs.filter((tab) => tab.kind !== ViewKind.Editor);

export const shellTitleOf = (project: string, title: string): string => `${project} · ${title}`;

export const barControlsOf = (kind: ViewKind): FocusControl[] => VIEWS[kind].controls;
