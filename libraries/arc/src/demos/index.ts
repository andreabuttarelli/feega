import type { JSX } from 'react';
import { BlocksAppDemo } from './blocks-app';
import { BlocksAuthDemo } from './blocks-auth';
import { BlocksBandDemo } from './blocks-band';
import { BlocksCompareDemo } from './blocks-compare';
import { BlocksContactDemo } from './blocks-contact';
import { BlocksContentDemo } from './blocks-content';
import { BlocksMarketingDemo } from './blocks-marketing';
import { BlocksSiteDemo } from './blocks-site';
import { ButtonsDemo } from './buttons';
import { ChartsCoreDemo } from './charts-core';
import { ChartsMoreDemo } from './charts-more';
import { DataDisplayDemo } from './data-display';
import { DataMediaDemo } from './data-media';
import { DataTablesDemo } from './data-tables';
import { EditorsDemo } from './editors';
import { FeedbackDemo } from './feedback';
import { FormsDemo } from './forms';
import { NavigationDemo } from './navigation';
import { OverlayDialogDemo } from './overlay-dialog';
import { OverlayDrawerDemo } from './overlay-drawer';
import { OverlayHoverDemo } from './overlay-hover';
import { OverlayMenusDemo } from './overlay-menus';
import { OverlayNotificationsDemo } from './overlay-notifications';
import { OverlayNoticesDemo } from './overlay-notices';
import { OverlayPopoversDemo } from './overlay-popovers';
import { OverlaySheetDemo } from './overlay-sheet';
import { OverlayTooltipDemo } from './overlay-tooltip';
import { OverlayUserMenuDemo } from './overlay-user-menu';
import { PickersDemo } from './pickers';
import { SelectionDemo } from './selection';
import { TextDemo } from './text';

export type DemoPage = { slug: string; title: string; Demo: () => JSX.Element };

export const PAGES: DemoPage[] = [
  { slug: 'buttons', title: 'Buttons and actions', Demo: ButtonsDemo },
  { slug: 'forms', title: 'Text inputs', Demo: FormsDemo },
  { slug: 'selection', title: 'Selection controls', Demo: SelectionDemo },
  { slug: 'pickers', title: 'Pickers and sliders', Demo: PickersDemo },
  { slug: 'editors', title: 'Editors and uploads', Demo: EditorsDemo },
  { slug: 'navigation', title: 'Navigation and disclosure', Demo: NavigationDemo },
  { slug: 'feedback', title: 'Feedback and progress', Demo: FeedbackDemo },
  { slug: 'data-display', title: 'Data display', Demo: DataDisplayDemo },
  { slug: 'data-media', title: 'Media, code and JSON', Demo: DataMediaDemo },
  { slug: 'data-tables', title: 'Tables, trees and threads', Demo: DataTablesDemo },
  { slug: 'charts-core', title: 'Charts', Demo: ChartsCoreDemo },
  { slug: 'charts-more', title: 'More charts', Demo: ChartsMoreDemo },
  { slug: 'text', title: 'Text effects', Demo: TextDemo },
  { slug: 'overlay-dialog', title: 'Dialog open', Demo: OverlayDialogDemo },
  { slug: 'overlay-drawer', title: 'Drawer open', Demo: OverlayDrawerDemo },
  { slug: 'overlay-sheet', title: 'Bottom sheet open', Demo: OverlaySheetDemo },
  { slug: 'overlay-popovers', title: 'Popover open', Demo: OverlayPopoversDemo },
  { slug: 'overlay-hover', title: 'Hover card open', Demo: OverlayHoverDemo },
  { slug: 'overlay-tooltip', title: 'Tooltip open and command palette', Demo: OverlayTooltipDemo },
  { slug: 'overlay-notifications', title: 'Notification center open', Demo: OverlayNotificationsDemo },
  { slug: 'overlay-user-menu', title: 'User menu open', Demo: OverlayUserMenuDemo },
  { slug: 'overlay-menus', title: 'Menus open', Demo: OverlayMenusDemo },
  { slug: 'overlay-notices', title: 'Toasts and cookie consent', Demo: OverlayNoticesDemo },
  { slug: 'blocks-site', title: 'Blocks: header and hero', Demo: BlocksSiteDemo },
  { slug: 'blocks-marketing', title: 'Blocks: call to action and FAQ', Demo: BlocksMarketingDemo },
  { slug: 'blocks-contact', title: 'Blocks: contact, newsletter, sign in', Demo: BlocksContactDemo },
  { slug: 'blocks-band', title: 'Blocks: logos, stats, footer', Demo: BlocksBandDemo },
  { slug: 'blocks-content', title: 'Blocks: blog grid', Demo: BlocksContentDemo },
  { slug: 'blocks-compare', title: 'Blocks: changelog and comparison', Demo: BlocksCompareDemo },
  { slug: 'blocks-app', title: 'Blocks: plans, page header, empty states', Demo: BlocksAppDemo },
  { slug: 'blocks-auth', title: 'Blocks: signup and login', Demo: BlocksAuthDemo }
];
