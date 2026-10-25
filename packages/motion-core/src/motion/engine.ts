export enum Engine {
  WebKit = 'webkit',
  Other = 'other'
}

export const WEBKIT_UA = /AppleWebKit/;
export const NOT_WEBKIT_UA = /Chrome\/|Firefox\//;

export function engineOf(userAgent: string): Engine {
  return WEBKIT_UA.test(userAgent) && !NOT_WEBKIT_UA.test(userAgent) ? Engine.WebKit : Engine.Other;
}
