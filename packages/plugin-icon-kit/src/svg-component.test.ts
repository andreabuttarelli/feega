import { describe, expect, it } from 'vitest';
import { Framework } from '@feega/plugin-api/protocol';
import { attributesOf, componentName, svgComponent, type SvgSpec } from './svg-component';

const SPEC: SvgSpec = {
  name: 'CameraIcon',
  viewBox: '0 0 24 24',
  body: '<path d="M1 1"/>',
  fixed: { fill: 'none', 'stroke-linecap': 'round' },
  bound: { width: 'size', height: 'size', stroke: 'color', 'stroke-width': 'strokeWidth' },
  props: [
    { name: 'size', fallback: 24 },
    { name: 'strokeWidth', fallback: 2 },
    { name: 'color', fallback: 'currentColor' }
  ]
};

const make = (framework: Framework, typescript = true, svelte5 = true) => svgComponent(SPEC, framework, { typescript, svelte5 });

describe('component names', () => {
  it('turns a kebab name into a PascalCase icon component', () => {
    expect(componentName('arrow-up-right')).toBe('ArrowUpRightIcon');
    expect(componentName('grid-2x2')).toBe('Grid2x2Icon');
  });

  it('puts a variant before the suffix', () => {
    expect(componentName('camera', 'bold')).toBe('CameraBoldIcon');
    expect(componentName('camera', '')).toBe('CameraIcon');
  });

  it('starts with a letter even when the icon name starts with a digit', () => {
    expect(componentName('1password')).toBe('Icon1passwordIcon');
  });

  it('drops characters that are not valid in a name', () => {
    expect(componentName('.net')).toBe('NetIcon');
  });
});

describe('inline svg component', () => {
  it('writes a Svelte 5 component with props', () => {
    const file = make(Framework.Svelte);

    expect(file.file).toBe('src/feega/icons/CameraIcon.svelte');
    expect(file.source).toContain("let { size = 24, strokeWidth = 2, color = 'currentColor', ...rest } = $props();");
    expect(file.source).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-linecap="round" width={size} height={size} stroke={color} stroke-width={strokeWidth} {...rest}>');
    expect(file.source).toContain('<path d="M1 1"/>');
  });

  it('writes a Svelte 4 component with exported props', () => {
    const file = make(Framework.Svelte, true, false);

    expect(file.source).toContain('export let size = 24;');
    expect(file.source).toContain('{...$$restProps}');
    expect(file.source).not.toContain('$props');
  });

  it('writes a typed React component', () => {
    const file = make(Framework.React);

    expect(file.file).toBe('src/feega/icons/CameraIcon.tsx');
    expect(file.source).toContain("size = 24, strokeWidth = 2, color = 'currentColor'");
    expect(file.source).toContain('strokeLinecap="round"');
    expect(file.source).toContain('strokeWidth={strokeWidth}');
    expect(file.source).toContain('export default function CameraIcon(');
    expect(file.source).toContain('size?: number');
  });

  it('writes a plain React component for a JavaScript project', () => {
    const file = make(Framework.React, false);

    expect(file.file).toBe('src/feega/icons/CameraIcon.jsx');
    expect(file.source).not.toContain('size?: number');
  });

  it('writes a Vue component whose attributes fall through to the svg', () => {
    const file = make(Framework.Vue);

    expect(file.file).toBe('src/feega/icons/CameraIcon.vue');
    expect(file.source).toContain('size: { type: Number, default: 24 }');
    expect(file.source).toContain("color: { type: String, default: 'currentColor' }");
    expect(file.source).toContain(':width="size"');
    expect(file.source).toContain(':stroke-width="strokeWidth"');
  });

  it('writes an Astro component', () => {
    const file = make(Framework.Astro);

    expect(file.file).toBe('src/feega/icons/CameraIcon.astro');
    expect(file.source).toContain("const { size = 24, strokeWidth = 2, color = 'currentColor', ...rest } = Astro.props;");
    expect(file.source).toContain('width={size}');
  });
});

describe('attributes on the tag', () => {
  const values = { size: 32, strokeWidth: 2, color: '#ff0000' };

  it('writes only what differs from the defaults', () => {
    expect(attributesOf(Framework.Svelte, SPEC.props, values)).toBe('size={32} color="#ff0000"');
  });

  it('writes nothing when everything is the default', () => {
    expect(attributesOf(Framework.React, SPEC.props, { size: 24, strokeWidth: 2, color: 'currentColor' })).toBe('');
  });

  it('binds numbers in Vue', () => {
    expect(attributesOf(Framework.Vue, SPEC.props, values)).toBe(':size="32" color="#ff0000"');
  });

  it('uses braces for numbers in React and Astro', () => {
    expect(attributesOf(Framework.React, SPEC.props, { ...values, strokeWidth: 1.5 })).toBe('size={32} strokeWidth={1.5} color="#ff0000"');
    expect(attributesOf(Framework.Astro, SPEC.props, values)).toBe('size={32} color="#ff0000"');
  });
});
