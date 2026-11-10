import { describe, expect, it } from 'vitest';
import { customComponentSchema, MAX_JS, MAX_PROPS, PropFormat } from '../custom/component';
import { SNAPCN_PORTS } from './catalog';
import { snapcnComponent, snapcnSource } from './model';

const ISOLATED_GLOBALS = ['root', 'props', 'tl', 'duration', 'fps'];

describe('snapcn catalog', () => {
  it('ports every free snapcn component it lists, once', () => {
    const ids = SNAPCN_PORTS.map((p) => p.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(SNAPCN_PORTS.map((p) => [p.id, p]))('%s is a valid deterministic custom component', (_, port) => {
    const component = snapcnComponent(port);
    expect(customComponentSchema.safeParse(component).success).toBe(true);
    expect(component.source.js.length).toBeLessThan(MAX_JS);
    expect(Object.keys(component.propsSchema.properties).length).toBeLessThanOrEqual(MAX_PROPS);
  });

  it.each(SNAPCN_PORTS.map((p) => [p.id, p]))('%s source compiles with no reference outside its own scope', (_, port) => {
    expect(() => new Function(...ISOLATED_GLOBALS, snapcnSource(port))).not.toThrow();
    expect(snapcnSource(port)).not.toMatch(/__vite_ssr_import|__name\(|import\(/);
  });

  it('no port exposes a media field as plain text', () => {
    const MEDIA_TITLE = /\b(urls?|images?|videos?|clips?|logo|avatars?|screenshot|photos?)\b/i;
    const MEDIA_KEY = /^(src|screenSrc|logoSrc|mark|plate|sky|slides|collage|videos|images|image\d?|heroImage|chipImage|backdropImage|cardImages|avatars)$/;
    const plain = SNAPCN_PORTS.flatMap((port) =>
      Object.entries(port.props)
        .filter(([key, spec]) => spec.type === 'string' && !spec.enum && !spec.format && (MEDIA_KEY.test(key) || MEDIA_TITLE.test(spec.title ?? '')))
        .map(([key]) => `${port.id}.${key}`)
    );

    expect(plain).toEqual([]);
  });

  it('every media prop is an asset or media picker with an empty default', () => {
    const MEDIA_FORMATS = new Set<string | undefined>([PropFormat.Asset, PropFormat.Media]);
    const bad = SNAPCN_PORTS.flatMap((port) =>
      Object.entries(port.props)
        .filter(([, spec]) => MEDIA_FORMATS.has(spec.format))
        .filter(([, spec]) => (spec.format === PropFormat.Asset ? spec.default !== null : spec.default !== ''))
        .map(([key]) => `${port.id}.${key}`)
    );

    expect(bad).toEqual([]);
  });
});
