import { LINKS } from './settings';

export enum SupportItem {
  Star = 'star',
  FollowX = 'follow_x',
  Discord = 'discord',
  Coffee = 'coffee',
  Share = 'share'
}

export type SupportEntry = { id: SupportItem; label: string; karma: number; url?: string; text?: string };

const SITE_URL = 'https://www.feega.app';

export const SUPPORT_ITEMS: SupportEntry[] = [
  { id: SupportItem.Star, label: 'Star the repository', karma: 10, url: 'https://github.com/andreabuttarelli/feega' },
  { id: SupportItem.FollowX, label: 'Follow Feega on X', karma: 5, url: 'https://x.com/feega_app' },
  { id: SupportItem.Discord, label: 'Join the Discord', karma: 5, url: LINKS.discord },
  { id: SupportItem.Coffee, label: 'Support with a coffee', karma: 20, url: 'https://buy.stripe.com/5kQ00k2A97C08sd94LeME07' },
  { id: SupportItem.Share, label: 'Share Feega (copies a text)', karma: 10, text: `I design in my codebase with Feega: click an element in the running app, edit it, the change lands in the source. Free and open source. ${SITE_URL}` }
];

export const isSupportItem = (value: unknown): value is SupportItem => SUPPORT_ITEMS.some((item) => item.id === value);

export function supportSummary(done: SupportItem[]): { karma: number; complete: boolean } {
  const doneSet = new Set(done);

  return {
    karma: SUPPORT_ITEMS.filter((item) => doneSet.has(item.id)).reduce((sum, item) => sum + item.karma, 0),
    complete: SUPPORT_ITEMS.every((item) => doneSet.has(item.id))
  };
}
