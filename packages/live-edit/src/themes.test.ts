import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, ThemeKind, combinedMedia, readThemes, themeTarget, type ThemeProject } from './themes';

const project = (over: Partial<ThemeProject> = {}): ThemeProject => ({ packageJson: null, tailwindConfig: null, sheets: [], sources: [], ...over });

const names = (p: ThemeProject) => readThemes(p).map((t) => t.name);

const themeOf = (p: ThemeProject, name: string) => readThemes(p).find((t) => t.name === name)!;

describe('readThemes', () => {
  it('lists only default when the project has no theme', () => {
    expect(names(project({ sheets: ['.a { color: red }'] }))).toEqual([DEFAULT_THEME]);
  });

  it('reads a media dark from prefers-color-scheme', () => {
    const dark = themeOf(project({ sheets: ['@media (prefers-color-scheme: dark) { .a { color: red } }'] }), 'dark');
    expect(dark.apply).toEqual({ kind: ThemeKind.Media, target: 'html', value: 'dark' });
    expect(names(project({ sheets: ['@media (prefers-color-scheme: dark) {}'] }))).not.toContain('light');
  });

  it('reads a light media query only when it is written', () => {
    expect(names(project({ sheets: ['@media (prefers-color-scheme: light) {}'] }))).toEqual([DEFAULT_THEME, 'light']);
  });

  it('reads tailwind v3 darkMode class', () => {
    const dark = themeOf(project({ tailwindConfig: "export default { darkMode: 'class' }" }), 'dark');
    expect(dark.apply).toEqual({ kind: ThemeKind.Class, target: 'html', value: 'dark' });
    expect(dark.variant).toBe('dark');
  });

  it('reads tailwind v3 darkMode media', () => {
    expect(themeOf(project({ tailwindConfig: "export default { darkMode: 'media' }" }), 'dark').apply.kind).toBe(ThemeKind.Media);
  });

  it('reads tailwind v3 darkMode selector with an attribute', () => {
    const dark = themeOf(project({ tailwindConfig: `export default { darkMode: ['selector', '[data-mode="night"]'] }` }), 'dark');
    expect(dark.apply).toEqual({ kind: ThemeKind.Attribute, target: 'html', attribute: 'data-mode', value: 'night' });
  });

  it('reads tailwind v3 darkMode class with a custom class', () => {
    expect(themeOf(project({ tailwindConfig: `export default { darkMode: ['class', '.night'] }` }), 'dark').apply.value).toBe('night');
  });

  it('reads a tailwind v4 custom variant', () => {
    const sheet = '@import "tailwindcss";\n@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));';
    const dark = themeOf(project({ sheets: [sheet] }), 'dark');
    expect(dark.apply).toEqual({ kind: ThemeKind.Attribute, target: 'html', attribute: 'data-theme', value: 'dark' });
    expect(dark.variant).toBe('dark');
  });

  it('reads a v4 custom variant under another name', () => {
    const sheet = '@import "tailwindcss";\n@custom-variant ocean (&:where(.theme-ocean, .theme-ocean *));';
    const ocean = themeOf(project({ sheets: [sheet] }), 'ocean');
    expect(ocean.apply).toEqual({ kind: ThemeKind.Class, target: 'html', value: 'theme-ocean' });
    expect(ocean.variant).toBe('ocean');
  });

  it('offers tailwind media dark only when the sources use dark:', () => {
    const tailwind = { packageJson: '{"dependencies":{"tailwindcss":"^3"}}' };
    expect(names(project(tailwind))).toEqual([DEFAULT_THEME]);
    const used = themeOf(project({ ...tailwind, sources: ['<div class="bg-white dark:bg-black">'] }), 'dark');
    expect(used.apply.kind).toBe(ThemeKind.Media);
    expect(used.variant).toBe('dark');
  });

  it('reads class and attribute themes from css selectors', () => {
    const sheet = ':root { --a: 1 }\n.dark { --a: 2 }\n[data-theme="forest"] .card { color: green }\n.theme-sand, .other { color: tan }';
    const all = readThemes(project({ sheets: [sheet] }));
    expect(all.map((t) => t.name)).toEqual([DEFAULT_THEME, 'dark', 'forest', 'sand']);
    expect(all[1].apply).toEqual({ kind: ThemeKind.Class, target: 'html', value: 'dark' });
    expect(all[2].apply).toEqual({ kind: ThemeKind.Attribute, target: 'html', attribute: 'data-theme', value: 'forest' });
    expect(all[3].apply).toEqual({ kind: ThemeKind.Class, target: 'html', value: 'theme-sand' });
  });

  it('ignores selectors that only look like a theme', () => {
    expect(names(project({ sheets: ['.dark-mode-toggle { color: red }\n/* .dark { } */\n.a { width: 1.dark }'] }))).toEqual([DEFAULT_THEME]);
  });

  it('reads daisyui themes from the tailwind config', () => {
    const p = project({ packageJson: '{"devDependencies":{"daisyui":"^4"}}', tailwindConfig: `module.exports = { daisyui: { themes: ["light", "cupcake", { mine: { primary: "#fff" } }] } }` });
    expect(names(p)).toEqual([DEFAULT_THEME, 'light', 'cupcake']);
    expect(themeOf(p, 'cupcake').apply).toEqual({ kind: ThemeKind.Attribute, target: 'html', attribute: 'data-theme', value: 'cupcake' });
  });

  it('reads daisyui v5 themes from the plugin block', () => {
    const p = project({ packageJson: '{"dependencies":{"daisyui":"^5"}}', sheets: ['@plugin "daisyui" { themes: light --default, dark --prefersdark, retro; }'] });
    expect(names(p)).toEqual([DEFAULT_THEME, 'light', 'dark', 'retro']);
  });

  it('falls back to the daisyui built-in light and dark', () => {
    expect(names(project({ packageJson: '{"dependencies":{"daisyui":"^5"}}' }))).toEqual([DEFAULT_THEME, 'light', 'dark']);
  });

  it('reads next-themes with the class attribute', () => {
    const p = project({ packageJson: '{"dependencies":{"next-themes":"^0.3"}}', sources: ['<ThemeProvider attribute="class" defaultTheme="system">'] });
    expect(names(p)).toEqual([DEFAULT_THEME, 'light', 'dark']);
    expect(themeOf(p, 'dark').apply).toEqual({ kind: ThemeKind.Class, target: 'html', value: 'dark' });
  });

  it('reads next-themes with a themes list, values and the default attribute', () => {
    const sources = [`<ThemeProvider themes={['light', 'dark', 'ocean']} value={{ dark: 'night' }}>`];
    const p = project({ packageJson: '{"dependencies":{"next-themes":"^0.3"}}', sources });
    expect(names(p)).toEqual([DEFAULT_THEME, 'light', 'dark', 'ocean']);
    expect(themeOf(p, 'dark').apply).toEqual({ kind: ThemeKind.Attribute, target: 'html', attribute: 'data-theme', value: 'night' });
    expect(themeOf(p, 'ocean').apply.value).toBe('ocean');
  });

  it('reads mode-watcher as a dark class', () => {
    const p = project({ packageJson: '{"dependencies":{"mode-watcher":"^0.5"}}' });
    expect(names(p)).toEqual([DEFAULT_THEME, 'dark']);
    expect(themeOf(p, 'dark').apply.kind).toBe(ThemeKind.Class);
  });

  it('keeps one entry per name, the framework first', () => {
    const p = project({ tailwindConfig: "export default { darkMode: 'class' }", sheets: ['@media (prefers-color-scheme: dark) {}\n.dark {}'] });
    expect(readThemes(p).filter((t) => t.name === 'dark')).toHaveLength(1);
    expect(themeOf(p, 'dark').apply.kind).toBe(ThemeKind.Class);
  });
});

describe('themeTarget', () => {
  const p = project({ tailwindConfig: "export default { darkMode: 'class' }", sheets: ['[data-theme="forest"] .a {}\n@media (prefers-color-scheme: light) {}'] });
  const themes = readThemes(p);

  it('writes nothing special on default', () => {
    expect(themeTarget(themes, DEFAULT_THEME)).toEqual({ variant: '', media: null, within: null });
  });

  it('writes a class theme under its class and the tailwind variant', () => {
    expect(themeTarget(themes, 'dark')).toEqual({ variant: 'dark', media: null, within: '.dark' });
  });

  it('writes an attribute theme under its attribute', () => {
    expect(themeTarget(themes, 'forest')).toEqual({ variant: null, media: null, within: '[data-theme="forest"]' });
  });

  it('writes a media theme into the media query', () => {
    expect(themeTarget(themes, 'light')).toEqual({ variant: null, media: '(prefers-color-scheme: light)', within: null });
  });

  it('rejects a theme the project does not have', () => {
    expect(themeTarget(themes, 'nope')).toBeNull();
  });
});

describe('combinedMedia', () => {
  it('joins breakpoint and theme', () => {
    expect(combinedMedia('(min-width: 768px)', '(prefers-color-scheme: dark)')).toBe('(min-width: 768px) and (prefers-color-scheme: dark)');
  });

  it('keeps the one that exists', () => {
    expect(combinedMedia(null, '(prefers-color-scheme: dark)')).toBe('(prefers-color-scheme: dark)');
    expect(combinedMedia('(min-width: 768px)', null)).toBe('(min-width: 768px)');
    expect(combinedMedia(undefined, null)).toBeUndefined();
  });
});
