import type { Component } from 'svelte';
import LayoutGrid from '@lucide/svelte/icons/layout-grid';
import LayoutTemplate from '@lucide/svelte/icons/layout-template';
import Settings from '@lucide/svelte/icons/settings';
import CreditCard from '@lucide/svelte/icons/credit-card';
import Sparkles from '@lucide/svelte/icons/sparkles';
import Flag from '@lucide/svelte/icons/flag';
import Scale from '@lucide/svelte/icons/scale';
import SunMoon from '@lucide/svelte/icons/sun-moon';
import LogOut from '@lucide/svelte/icons/log-out';
import Shapes from '@lucide/svelte/icons/shapes';
import Wrench from '@lucide/svelte/icons/wrench';
import Users from '@lucide/svelte/icons/users';
import CircleHelp from '@lucide/svelte/icons/circle-help';
import { REPORT_PATH } from '$lib/reports/report-link';
import { BILLING_PATH } from '$lib/billing-path';

export enum NavSection {
  Main = 'main',
  Account = 'account'
}

export enum NavKind {
  Link = 'link',
  Legal = 'legal',
  Theme = 'theme',
  Tour = 'tour',
  Logout = 'logout'
}

export enum NavNeeds {
  Nothing = 'nothing',
  Project = 'project'
}

export enum NavLoad {
  Client = 'client',
  Document = 'document'
}

export enum NavMeta {
  None = 'none',
  Credits = 'credits'
}

export type NavLabel = { key: string } | { text: string };

export type NavItem = {
  id: string;
  section: NavSection;
  kind: NavKind;
  label: NavLabel;
  icon: Component<{ size?: number; strokeWidth?: number }>;
  needs: NavNeeds;
  load: NavLoad;
  badge: string | null;
  meta: NavMeta;
  href: (projectId: string | null) => string | null;
};

const DASHBOARD_PATH = '/app';
const CANVASES_PATH = `${DASHBOARD_PATH}/canvases`;
const TEMPLATES_PATH = `${DASHBOARD_PATH}/templates`;
export const TEAM_PATH = `${DASHBOARD_PATH}/team`;
export const TOOLS_PATH = `${DASHBOARD_PATH}/tools`;

const none = () => null;

const row = (item: Omit<NavItem, 'needs' | 'load' | 'badge' | 'meta' | 'href'> & Partial<NavItem>): NavItem => ({
  needs: NavNeeds.Nothing,
  load: NavLoad.Client,
  badge: null,
  meta: NavMeta.None,
  href: none,
  ...item
});

const inProject = (path: string) => (projectId: string | null) => (projectId ? `/p/${projectId}${path}` : null);

export const APP_NAV: readonly NavItem[] = [
  row({ id: 'home', section: NavSection.Main, kind: NavKind.Link, label: { key: 'app.shell.menu.home' }, icon: LayoutGrid, href: () => DASHBOARD_PATH }),
  row({ id: 'canvases', section: NavSection.Main, kind: NavKind.Link, label: { text: 'Canvases' }, icon: Shapes, href: () => CANVASES_PATH }),
  row({ id: 'templates', section: NavSection.Main, kind: NavKind.Link, label: { text: 'Frame templates' }, icon: LayoutTemplate, href: () => TEMPLATES_PATH }),
  row({ id: 'tools', section: NavSection.Main, kind: NavKind.Link, label: { text: 'Tools' }, icon: Wrench, href: () => TOOLS_PATH }),
  row({ id: 'settings', section: NavSection.Account, kind: NavKind.Link, label: { key: 'app.shell.menu.settings' }, icon: Settings, needs: NavNeeds.Project, href: inProject('/settings/project') }),
  row({ id: 'team', section: NavSection.Account, kind: NavKind.Link, label: { text: 'Team' }, icon: Users, href: () => TEAM_PATH }),
  row({ id: 'billing', section: NavSection.Account, kind: NavKind.Link, label: { key: 'app.shell.menu.billing' }, icon: CreditCard, meta: NavMeta.Credits, href: () => BILLING_PATH }),
  row({ id: 'changelog', section: NavSection.Account, kind: NavKind.Link, label: { key: 'app.shell.menu.changelog' }, icon: Sparkles, load: NavLoad.Document, href: () => '/changelog' }),
  row({ id: 'report', section: NavSection.Account, kind: NavKind.Link, label: { key: 'app.shell.menu.report' }, icon: Flag, href: () => REPORT_PATH }),
  row({ id: 'tour', section: NavSection.Account, kind: NavKind.Tour, label: { text: 'How feega works' }, icon: CircleHelp }),
  row({ id: 'legal', section: NavSection.Account, kind: NavKind.Legal, label: { key: 'legal.menuLabel' }, icon: Scale }),
  row({ id: 'theme', section: NavSection.Account, kind: NavKind.Theme, label: { text: 'Theme' }, icon: SunMoon }),
  row({ id: 'logout', section: NavSection.Account, kind: NavKind.Logout, label: { key: 'app.shell.menu.logout' }, icon: LogOut })
];

export function visibleNav(projectId: string | null): NavItem[] {
  return APP_NAV.filter((item) => item.needs === NavNeeds.Nothing || projectId !== null);
}

export function navHref(item: NavItem, projectId: string | null): string | null {
  return item.href(projectId);
}

export function isNavActive(href: string, pathname: string): boolean {
  const path = href.split('?')[0];
  if (path === DASHBOARD_PATH) {
    return pathname === DASHBOARD_PATH;
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}
