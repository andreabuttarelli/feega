export enum ViewKind {
  Editor = 'editor',
  PagesCanvas = 'pages-canvas',
  ComponentsCanvas = 'components-canvas',
  Focus = 'focus'
}

export enum ViewIcon {
  House = 'house',
  Grid = 'grid',
  Boxes = 'boxes',
  Component = 'component'
}

export enum Chrome {
  Full = 'full',
  Bare = 'bare'
}

export enum HostKind {
  Browser = 'browser',
  Desktop = 'desktop',
  VsCode = 'vscode'
}

export enum Presentation {
  TopRow = 'top-row',
  ShellTabs = 'shell-tabs'
}

export enum FocusControl {
  Zoom = 'zoom',
  Scheme = 'scheme',
  Transparent = 'transparent'
}

type ViewSpec = { title: (name: string) => string; icon: ViewIcon; closable: boolean; controls: FocusControl[]; chrome: Chrome };

export const VIEWS: Record<ViewKind, ViewSpec> = {
  [ViewKind.Editor]: { title: () => 'Page', icon: ViewIcon.House, closable: false, controls: [], chrome: Chrome.Full },
  [ViewKind.PagesCanvas]: { title: () => 'Pages canvas', icon: ViewIcon.Grid, closable: true, controls: [], chrome: Chrome.Bare },
  [ViewKind.ComponentsCanvas]: { title: () => 'Components canvas', icon: ViewIcon.Boxes, closable: true, controls: [], chrome: Chrome.Bare },
  [ViewKind.Focus]: { title: (name) => name, icon: ViewIcon.Component, closable: true, controls: [FocusControl.Zoom, FocusControl.Scheme, FocusControl.Transparent], chrome: Chrome.Full }
};

const PRESENTATION: Record<HostKind, Presentation> = {
  [HostKind.Browser]: Presentation.TopRow,
  [HostKind.Desktop]: Presentation.ShellTabs,
  [HostKind.VsCode]: Presentation.TopRow
};

export const presentationOf = (host: HostKind): Presentation => PRESENTATION[host];

export enum SettingsRoute {
  Submenus = 'submenus',
  DesktopPage = 'desktop-page'
}

const SETTINGS_ROUTE: Record<HostKind, SettingsRoute> = {
  [HostKind.Browser]: SettingsRoute.Submenus,
  [HostKind.Desktop]: SettingsRoute.DesktopPage,
  [HostKind.VsCode]: SettingsRoute.Submenus
};

export const settingsRouteOf = (host: HostKind): SettingsRoute => SETTINGS_ROUTE[host];

export type ViewTab = { id: string; kind: ViewKind; title: string; icon: ViewIcon; closable: boolean; active: boolean };

export type OpenViews = { focus: string | null; pages: boolean; components: boolean };

const tabOf = (kind: ViewKind, name: string, active: ViewKind): ViewTab => ({ id: kind, kind, title: VIEWS[kind].title(name), icon: VIEWS[kind].icon, closable: VIEWS[kind].closable, active: kind === active });

export function tabsOf(open: OpenViews, active: ViewKind): ViewTab[] {
  const tabs = [tabOf(ViewKind.Editor, '', active)];
  if (open.pages) {
    tabs.push(tabOf(ViewKind.PagesCanvas, '', active));
  }
  if (open.components) {
    tabs.push(tabOf(ViewKind.ComponentsCanvas, '', active));
  }
  if (open.focus !== null) {
    tabs.push(tabOf(ViewKind.Focus, open.focus, active));
  }
  return tabs;
}

export const rowTabsOf = (project: string, tabs: ViewTab[]): ViewTab[] => tabs.map((tab) => (tab.kind === ViewKind.Editor ? { ...tab, title: project } : tab));

export const shellTabsOf = (tabs: ViewTab[]): ViewTab[] => tabs.filter((tab) => tab.kind !== ViewKind.Editor);

export const shellTitleOf = (project: string, title: string): string => `${project} · ${title}`;

export const barControlsOf = (kind: ViewKind): FocusControl[] => VIEWS[kind].controls;

export const chromeOf = (kind: ViewKind): Chrome => VIEWS[kind].chrome;
