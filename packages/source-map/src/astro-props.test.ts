import { describe, expect, it } from 'vitest';
import { astroControlsOf } from './astro-props.ts';
import { PropKind } from './prop-model.ts';

const page = (frontmatter: string) => `---\n${frontmatter}\n---\n<p />\n`;

describe('astroControlsOf', () => {
  it('reads an interface Props and the destructuring of Astro.props', () => {
    const code = page("interface Props { title: string; size?: 'sm' | 'lg'; count?: number }\nconst { title, size = 'sm', count = 2 } = Astro.props;");

    expect(astroControlsOf(code)).toEqual([
      { name: 'title', kind: PropKind.Text, required: true },
      { name: 'size', kind: PropKind.Select, required: false, options: ['sm', 'lg'], default: 'sm' },
      { name: 'count', kind: PropKind.Number, required: false, default: 2 }
    ]);
  });

  it('reads a type alias Props exported from the frontmatter', () => {
    expect(astroControlsOf(page('export type Props = { on: boolean };\nconst { on } = Astro.props;'))).toEqual([{ name: 'on', kind: PropKind.Toggle, required: true }]);
  });

  it('reads Props when Astro.props is not destructured', () => {
    expect(astroControlsOf(page('interface Props { label: string }\nconst props = Astro.props;'))).toEqual([{ name: 'label', kind: PropKind.Text, required: true }]);
  });

  it('guesses from defaults when there is no Props type', () => {
    expect(astroControlsOf(page("const { label = 'Hi', big = false } = Astro.props;"))).toEqual([
      { name: 'label', kind: PropKind.Text, required: false, default: 'Hi' },
      { name: 'big', kind: PropKind.Toggle, required: false, default: false }
    ]);
  });

  it('keeps array and object defaults', () => {
    const controls = astroControlsOf(page("const { tags = ['a'], style = { gap: 2 } } = Astro.props;"));

    expect(controls).toEqual([
      { name: 'tags', kind: PropKind.Array, required: false, default: ['a'] },
      { name: 'style', kind: PropKind.Object, required: false, default: { gap: 2 } }
    ]);
  });

  it('answers null when the component reads no props', () => {
    expect(astroControlsOf(page('const a = 1;'))).toBeNull();
    expect(astroControlsOf('<p />')).toBeNull();
  });

  it('answers null for frontmatter it cannot parse', () => {
    expect(astroControlsOf(page('const {'))).toBeNull();
  });
});
