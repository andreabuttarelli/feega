import { describe, expect, it } from 'vitest';
import { customComponentSchema, MAX_JS, MAX_PROPS, PropFormat } from '../custom/component';
import { HF_PORTS } from './catalog';
import { hfComponent, hfSource } from './model';

const ISOLATED_GLOBALS = ['root', 'props', 'tl', 'duration', 'fps'];

const BRANDS = /\b(slack|spotify|chatgpt|openai|tiktok|instagram|youtube|reddit|twitter|iphone|macos|ios|apple|google|claude|anthropic|heygen|hyperframes|facebook|linkedin|notion|stripe|figma|github|netflix|amazon)\b/i;

const ids = HF_PORTS.map((p) => [p.id, p] as const);

describe('hyperframes catalog', () => {
  it('lists every port once', () => {
    const all = HF_PORTS.map((p) => p.id);
    expect(all.length).toBeGreaterThan(0);
    expect(new Set(all).size).toBe(all.length);
  });

  it.each(ids)('%s is a valid deterministic custom component', (_, port) => {
    const component = hfComponent(port);
    expect(customComponentSchema.safeParse(component).success).toBe(true);
    expect(component.source.js.length).toBeLessThan(MAX_JS);
    expect(Object.keys(component.propsSchema.properties).length).toBeLessThanOrEqual(MAX_PROPS);
  });

  it.each(ids)('%s source compiles with no reference outside its own scope', (_, port) => {
    expect(() => new Function(...ISOLATED_GLOBALS, hfSource(port))).not.toThrow();
    expect(hfSource(port)).not.toMatch(/__vite_ssr_import|__name\(|import\(/);
  });

  it.each(ids)('%s names its upstream block or component and keeps its duration', (_, port) => {
    expect(port.source).toMatch(/^[a-z0-9-]+$/);
    expect(port.frames / port.fps).toBeGreaterThan(0.5);
  });

  it('no port uses a prop key the custom clip reserves', () => {
    const RESERVED = ['name'];
    const clashes = HF_PORTS.flatMap((port) => RESERVED.filter((key) => key in port.props).map((key) => `${port.id}.${key}`));

    expect(clashes).toEqual([]);
  });

  it('no port exposes a media field as plain text', () => {
    const MEDIA_TITLE = /\b(urls?|images?|videos?|clips?|logo|avatars?|screenshot|photos?)\b/i;
    const MEDIA_KEY = /^(src|screenSrc|logoSrc|image\d?|images|avatar|avatars|logo|photo|video|clip)$/;
    const plain = HF_PORTS.flatMap((port) =>
      Object.entries(port.props)
        .filter(([key, spec]) => spec.type === 'string' && !spec.enum && !spec.format && (MEDIA_KEY.test(key) || MEDIA_TITLE.test(spec.title ?? '')))
        .map(([key]) => `${port.id}.${key}`)
    );

    expect(plain).toEqual([]);
  });

  it('every media prop is an asset or media picker with an empty default', () => {
    const MEDIA_FORMATS = new Set<string | undefined>([PropFormat.Asset, PropFormat.Media]);
    const bad = HF_PORTS.flatMap((port) =>
      Object.entries(port.props)
        .filter(([, spec]) => MEDIA_FORMATS.has(spec.format))
        .filter(([, spec]) => (spec.format === PropFormat.Asset ? spec.default !== null : spec.default !== ''))
        .map(([key]) => `${port.id}.${key}`)
    );

    expect(bad).toEqual([]);
  });

  it('draws no brand name, and carries no upstream media or brand asset', () => {
    const shown = HF_PORTS.flatMap((port) => [port.id, port.title, port.about, ...Object.values(port.props).map((spec) => String(spec.default ?? '')), port.draw.toString()].filter((text) => BRANDS.test(text)).map(() => port.id));
    const remote = HF_PORTS.filter((port) => /https?:\/\/(?!www\.w3\.org)/.test(port.draw.toString())).map((port) => port.id);

    expect([...new Set(shown)]).toEqual([]);
    expect(remote).toEqual([]);
  });
});
