export enum DashboardPage {
  Home = 'home',
  Canvases = 'canvases',
  Templates = 'templates',
  Motion = 'motion',
  Credits = 'credits',
  Compose = 'compose'
}

export const PAGE_PATH: Record<DashboardPage, string> = {
  [DashboardPage.Home]: '/app',
  [DashboardPage.Canvases]: '/app/canvases',
  [DashboardPage.Templates]: '/app/templates',
  [DashboardPage.Motion]: '/app/motion',
  [DashboardPage.Credits]: '/app/credits',
  [DashboardPage.Compose]: '/app/compose'
};

export function pageAt(pathname: string): DashboardPage | null {
  const found = Object.entries(PAGE_PATH).find(([, path]) => path === pathname);
  return found ? (found[0] as DashboardPage) : null;
}

export function isDashboardPage(name: string): name is DashboardPage {
  return Object.values(DashboardPage).includes(name as DashboardPage);
}
