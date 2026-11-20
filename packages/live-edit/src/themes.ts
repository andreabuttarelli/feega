export enum ThemeKind {
  Default = 'default',
  Media = 'media',
  Class = 'class',
  Attribute = 'attribute'
}

export type Apply = { kind: ThemeKind; target: 'html'; attribute?: string; value: string };

export type Theme = { name: string; variant: string | null; apply: Apply };

export type ThemeProject = { packageJson: string | null; tailwindConfig: string | null; sheets: string[]; sources: string[] };

export type ThemeTarget = { variant: string | null; media: string | null; within: string | null };

export const DEFAULT_THEME = 'default';

const ROOT = 'html';
const DARK = 'dark';
const LIGHT = 'light';
const DATA_THEME = 'data-theme';
const CLASS_STRATEGY = 'class';
const MEDIA_STRATEGY = 'media';
const THEME_CLASS_PREFIX = 'theme-';
const DAISY_DEFAULTS = [LIGHT, DARK];

const SELECTOR_ROOT = /\[([\w-]+)\s*=\s*["']?([\w-]+)["']?\]|(?<![\w-])\.([\w-]+)/;
const SCHEME_QUERY = /prefers-color-scheme\s*:\s*(dark|light)/g;
const COMMENT = /\/\*[\s\S]*?\*\//g;
const PRELUDE = /([^{}]+)\{/g;
const THEME_ATTRIBUTE = /\[(data-(?:theme|mode|color-scheme|bs-theme))\s*=\s*["']?([\w-]+)["']?\]/g;
const THEME_CLASS = /(?<![\w-])\.(dark|light|theme-[\w-]+)(?![\w-])/g;
const DARK_MODE = /darkMode\s*:\s*(\[(?:[^\][]|\[[^\]]*\])*\]|['"][^'"]+['"])/;
const QUOTED = /(["'])(.+?)\1/g;
const CUSTOM_VARIANT = /@custom-variant\s+([\w-]+)\s*([^;]*;|\{[^}]*\})/g;
const DARK_UTILITY = /(^|[\s"'`{])dark:/;
const DAISY_LIST = /daisyui\s*:\s*\{[\s\S]*?themes\s*:\s*\[([\s\S]*?)\]\s*[,}]/;
const DAISY_PLUGIN = /@plugin\s+["']daisyui["']\s*\{([^}]*)\}/;
const DAISY_PLUGIN_THEMES = /themes\s*:\s*([^;]+);/;
const NESTED_OBJECT = /\{[^{}]*\}/g;
const NEXT_PROVIDER = /<(?:\w+\.)?ThemeProvider\b([\s\S]*?)\/?>/;
const NEXT_ATTRIBUTE = /attribute\s*[=:]\s*\{?\s*["']([\w-]+)["']/;
const NEXT_THEMES = /themes\s*[=:]\s*\{?\s*\[([^\]]*)\]/;
const NEXT_VALUES = /value\s*[=:]\s*\{\{?([^}]*)\}/;
const VALUE_PAIR = /([\w-]+)\s*:\s*["']([\w-]+)["']/g;

const theme = (name: string, apply: Omit<Apply, 'target'>, variant: string | null = null): Theme => ({ name, variant, apply: { ...apply, target: ROOT } });

const quoted = (text: string) => [...text.matchAll(QUOTED)].map((m) => m[2]);

const hasPackage = (project: ThemeProject, name: string) => project.packageJson?.includes(`"${name}"`) ?? false;

const bare = (sheets: string[]) => sheets.map((s) => s.replace(COMMENT, ''));

function rootApply(text: string): Omit<Apply, 'target'> | null {
  const found = SELECTOR_ROOT.exec(text);
  if (!found) {
    return null;
  }
  return found[3] ? { kind: ThemeKind.Class, value: found[3] } : { kind: ThemeKind.Attribute, attribute: found[1], value: found[2] };
}

function schemeOf(text: string): string | null {
  return [...text.matchAll(SCHEME_QUERY)][0]?.[1] ?? null;
}

function tailwindUsed(project: ThemeProject): boolean {
  return hasPackage(project, 'tailwindcss') || project.tailwindConfig !== null || project.sheets.some((s) => /@import\s+["']tailwindcss|@tailwind\s/.test(s));
}

function configDark(config: string | null): Theme | null {
  const found = config?.match(DARK_MODE);
  if (!found) {
    return null;
  }
  const [strategy, selector] = quoted(found[1]);
  if (strategy === MEDIA_STRATEGY) {
    return theme(DARK, { kind: ThemeKind.Media, value: DARK }, DARK);
  }
  const apply = selector ? rootApply(selector) : { kind: ThemeKind.Class, value: DARK };
  return apply ? theme(DARK, apply, DARK) : null;
}

function customVariants(sheets: string[]): Theme[] {
  return sheets.flatMap((sheet) =>
    [...sheet.matchAll(CUSTOM_VARIANT)].flatMap((m) => {
      const apply = rootApply(m[2]);
      const scheme = schemeOf(m[2]);
      if (apply) {
        return [theme(m[1], apply, m[1])];
      }
      return scheme ? [theme(m[1], { kind: ThemeKind.Media, value: scheme }, m[1])] : [];
    })
  );
}

function tailwindThemes(project: ThemeProject): Theme[] {
  if (!tailwindUsed(project)) {
    return [];
  }
  const sheets = bare(project.sheets);
  const explicit = [...customVariants(sheets), configDark(project.tailwindConfig)].filter((t): t is Theme => t !== null);
  const usesDark = project.sources.some((s) => DARK_UTILITY.test(s));
  return usesDark ? [...explicit, theme(DARK, { kind: ThemeKind.Media, value: DARK }, DARK)] : explicit;
}

function nextThemes(project: ThemeProject): Theme[] {
  if (!hasPackage(project, 'next-themes')) {
    return [];
  }
  const text = project.sources.join('\n');
  const props = text.match(NEXT_PROVIDER)?.[1] ?? text;
  const attribute = props.match(NEXT_ATTRIBUTE)?.[1] ?? DATA_THEME;
  const list = props.match(NEXT_THEMES);
  const names = list ? quoted(list[1]) : DAISY_DEFAULTS;
  const values = new Map([...(props.match(NEXT_VALUES)?.[1] ?? '').matchAll(VALUE_PAIR)].map((m) => [m[1], m[2]]));
  return names.map((name) => {
    const value = values.get(name) ?? name;
    return attribute === CLASS_STRATEGY ? theme(name, { kind: ThemeKind.Class, value }) : theme(name, { kind: ThemeKind.Attribute, attribute, value });
  });
}

const modeWatcherThemes = (project: ThemeProject): Theme[] => (hasPackage(project, 'mode-watcher') ? [theme(DARK, { kind: ThemeKind.Class, value: DARK })] : []);

function daisyNames(project: ThemeProject): string[] {
  const list = project.tailwindConfig?.match(DAISY_LIST)?.[1];
  if (list !== undefined) {
    let flat = list;
    for (let before = ''; before !== flat; ) {
      before = flat;
      flat = flat.replace(NESTED_OBJECT, '');
    }
    return quoted(flat);
  }
  const plugin = bare(project.sheets).map((s) => s.match(DAISY_PLUGIN)?.[1]).find(Boolean);
  const themes = plugin?.match(DAISY_PLUGIN_THEMES)?.[1];
  const names = themes?.split(',').map((t) => t.trim().split(/\s+/)[0]).filter((n) => n && n !== 'all' && n !== 'false') ?? [];
  return names.length ? names : DAISY_DEFAULTS;
}

const daisyThemes = (project: ThemeProject): Theme[] => (hasPackage(project, 'daisyui') ? daisyNames(project).map((name) => theme(name, { kind: ThemeKind.Attribute, attribute: DATA_THEME, value: name })) : []);

function selectorThemes(sheets: string[]): Theme[] {
  const preludes = sheets.flatMap((s) => [...s.matchAll(PRELUDE)].map((m) => m[1].trim()).filter((p) => !p.startsWith('@')));
  return preludes.flatMap((prelude) => [
    ...[...prelude.matchAll(THEME_ATTRIBUTE)].map((m) => theme(m[2], { kind: ThemeKind.Attribute, attribute: m[1], value: m[2] })),
    ...[...prelude.matchAll(THEME_CLASS)].map((m) => theme(m[1].replace(THEME_CLASS_PREFIX, ''), { kind: ThemeKind.Class, value: m[1] }))
  ]);
}

const mediaThemes = (sheets: string[]): Theme[] => sheets.flatMap((s) => [...s.matchAll(SCHEME_QUERY)].map((m) => theme(m[1], { kind: ThemeKind.Media, value: m[1] })));

export const DEFAULT: Theme = { name: DEFAULT_THEME, variant: '', apply: { kind: ThemeKind.Default, target: ROOT, value: '' } };

export function readThemes(project: ThemeProject): Theme[] {
  const sheets = bare(project.sheets);
  const found = [...tailwindThemes(project), ...nextThemes(project), ...modeWatcherThemes(project), ...daisyThemes(project), ...selectorThemes(sheets), ...mediaThemes(sheets)];
  const unique = new Map<string, Theme>();
  found.forEach((t) => !unique.has(t.name) && unique.set(t.name, t));
  return [DEFAULT, ...unique.values()];
}

const WITHIN: Record<ThemeKind, (apply: Apply) => string | null> = {
  [ThemeKind.Default]: () => null,
  [ThemeKind.Media]: () => null,
  [ThemeKind.Class]: (apply) => `.${apply.value}`,
  [ThemeKind.Attribute]: (apply) => `[${apply.attribute}="${apply.value}"]`
};

export function themeTarget(themes: Theme[], name: string): ThemeTarget | null {
  const found = themes.find((t) => t.name === name);
  if (!found) {
    return null;
  }
  const media = found.apply.kind === ThemeKind.Media ? `(prefers-color-scheme: ${found.apply.value})` : null;
  return { variant: found.variant, media, within: WITHIN[found.apply.kind](found.apply) };
}

export function combinedMedia(breakpoint: string | null | undefined, theme: string | null): string | null | undefined {
  if (theme === null) {
    return breakpoint;
  }
  return typeof breakpoint === 'string' ? `${breakpoint} and ${theme}` : theme;
}
