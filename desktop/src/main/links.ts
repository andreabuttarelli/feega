import { DISCORD_URL } from '../../../landing/src/lib/site/links';
import { Link } from './types';

export const LINKS: Record<Link, string> = {
  [Link.Account]: 'https://oh.feega.app/app/settings/profile',
  [Link.Docs]: 'https://docs.feega.app',
  [Link.Community]: DISCORD_URL
};
