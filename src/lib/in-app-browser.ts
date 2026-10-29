
import { isNativeShell } from './native-shell';

export type InAppBrowser = {
  isInApp: boolean;
  os: 'ios' | 'android' | 'other';
  app: string | null;
};

type Steps = Record<'ios' | 'android', string[]>;

type AppRule = { name: string; ua: RegExp; steps: Steps };

const MENU_SAFARI = ['Tap the menu in the top right corner.', 'Choose "Open in Safari".'];
const MENU_CHROME = ['Tap the menu in the top right corner.', 'Choose "Open in Chrome" or "Open in browser".'];

const APP_RULES: AppRule[] = [
  {
    name: 'Threads',
    ua: /Barcelona/i,
    steps: {
      ios: ['Tap the three dots at the top right.', 'Choose "Open in external browser".'],
      android: ['Tap the three dots at the top right.', 'Choose "Open in Chrome".']
    }
  },
  {
    name: 'Instagram',
    ua: /Instagram/i,
    steps: {
      ios: ['Tap the three dots (•••) at the top right.', 'Choose "Open in external browser".'],
      android: ['Tap the three dots (⋮) at the top right.', 'Choose "Open in Chrome".']
    }
  },
  {
    name: 'Messenger',
    ua: /(?<!Micro)Messenger/i,
    steps: {
      ios: ['Tap the three dots (•••) at the top right.', 'Choose "Open in Safari".'],
      android: ['Tap the three dots (⋮) at the top right.', 'Choose "Open in Chrome".']
    }
  },
  {
    name: 'Facebook',
    ua: /FBAN|FBAV|FB_IAB|FB4A|FBIOS/i,
    steps: {
      ios: ['Tap the three dots (•••) at the bottom or top right.', 'Choose "Open in Safari".'],
      android: ['Tap the three dots (⋮) at the top right.', 'Choose "Open in Chrome".']
    }
  },
  {
    name: 'TikTok',
    ua: /TikTok|musical_ly|BytedanceWebview|trill/i,
    steps: {
      ios: ['Tap the three dots (•••) at the top right.', 'Choose "Open in browser".'],
      android: ['Tap the three dots (⋮) at the top right.', 'Choose "Open in browser".']
    }
  },
  {
    name: 'LinkedIn',
    ua: /LinkedInApp/i,
    steps: {
      ios: ['Tap the compass icon at the bottom right.', 'Choose "Open in Safari".'],
      android: ['Tap the three dots (⋮) at the top right.', 'Choose "Open in browser".']
    }
  },
  { name: 'X', ua: /Twitter/i, steps: { ios: MENU_SAFARI, android: MENU_CHROME } },
  {
    name: 'LINE',
    ua: /Line\//i,
    steps: {
      ios: ['Tap the share icon at the bottom right.', 'Choose "Open in Safari".'],
      android: ['Tap the three dots (⋮) at the top right.', 'Choose "Open in other browser".']
    }
  },
  {
    name: 'Snapchat',
    ua: /Snapchat/i,
    steps: {
      ios: ['Tap the three dots (•••) at the top right.', 'Choose "Open in Safari".'],
      android: ['Tap the three dots (⋮) at the top right.', 'Choose "Open in browser".']
    }
  },
  {
    name: 'WeChat',
    ua: /MicroMessenger/i,
    steps: {
      ios: ['Tap the three dots (•••) at the top right.', 'Choose "Open in Safari".'],
      android: ['Tap the three dots (⋮) at the top right.', 'Choose "Open in browser".']
    }
  },
  { name: 'Pinterest', ua: /Pinterest/i, steps: { ios: MENU_SAFARI, android: MENU_CHROME } },
  { name: 'WhatsApp', ua: /WhatsApp/i, steps: { ios: MENU_SAFARI, android: MENU_CHROME } },
  { name: 'Google App', ua: /GSA\//i, steps: { ios: MENU_SAFARI, android: MENU_CHROME } }
];

const GENERIC_STEPS: Steps = {
  ios: [
    'Look for a menu (•••) or a share icon in this app.',
    'Choose "Open in Safari" or "Open in browser".',
    'Or copy the link below and paste it in Safari.'
  ],
  android: [
    'Look for a menu (⋮) in this app.',
    'Choose "Open in Chrome" or "Open in browser".',
    'Or copy the link below and paste it in Chrome.'
  ]
};

export type InAppGuide = { title: string; steps: string[] };

export function guideFor(detected: InAppBrowser): InAppGuide {
  const platform = detected.os === 'android' ? 'android' : 'ios';
  const rule = APP_RULES.find((r) => r.name === detected.app);
  const steps = rule ? rule.steps[platform] : GENERIC_STEPS[platform];
  const title = detected.app ? `In ${detected.app}` : 'In this app';
  return { title, steps };
}

export function detectInAppBrowser(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): InAppBrowser {
  const os: InAppBrowser['os'] = /iPhone|iPad|iPod/i.test(ua)
    ? 'ios'
    : /Android/i.test(ua)
      ? 'android'
      : 'other';

  const app = APP_RULES.find((r) => r.ua.test(ua))?.name ?? null;

  if (isNativeShell(ua)) {
    return { isInApp: false, os, app: null };
  }

  let isInApp = app !== null;
  if (!isInApp) {
    if (os === 'android' && /;\s*wv\)/i.test(ua)) isInApp = true;
    if (os === 'ios' && /AppleWebKit/i.test(ua) && !/Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua)) isInApp = true;
  }

  return { isInApp, os, app };
}

export function androidIntentUrl(rawUrl: string): string {
  const u = new URL(rawUrl);
  const scheme = u.protocol.replace(':', '');
  const withoutScheme = rawUrl.slice(u.protocol.length + 2);
  return `intent://${withoutScheme}#Intent;scheme=${scheme};action=android.intent.action.VIEW;end`;
}
