export enum Platform {
  IPhone = 'iphone',
  IPad = 'ipad',
  Android = 'android',
  Desktop = 'desktop'
}

type Rule = { platform: Platform; matches: (ua: string, touchPoints: number) => boolean };

const RULES: Rule[] = [
  { platform: Platform.IPhone, matches: (ua) => /iPhone|iPod/.test(ua) },
  { platform: Platform.IPad, matches: (ua) => /iPad/.test(ua) },
  { platform: Platform.IPad, matches: (ua, touchPoints) => /Macintosh/.test(ua) && touchPoints > 1 },
  { platform: Platform.Android, matches: (ua) => /Android/.test(ua) }
];

export const platformOf = (ua: string, touchPoints: number): Platform => RULES.find((r) => r.matches(ua, touchPoints))?.platform ?? Platform.Desktop;
