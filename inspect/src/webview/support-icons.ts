import { SupportItem } from '../support';
import { PixelIcon } from '@feega/pixel-icons/pixel';

export const SUPPORT_ICONS: Readonly<Record<SupportItem, PixelIcon>> = {
  [SupportItem.Star]: PixelIcon.Star,
  [SupportItem.FollowX]: PixelIcon.X,
  [SupportItem.Discord]: PixelIcon.Discord,
  [SupportItem.Coffee]: PixelIcon.Coffee,
  [SupportItem.Share]: PixelIcon.Share
};
