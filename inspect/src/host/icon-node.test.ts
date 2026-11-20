import { describe, expect, it } from 'vitest';
import { svgOfSource } from './icon-node';

const ARROW = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';

describe('svgOfSource', () => {
  it('reads the node list of a lucide-react module', () => {
    const source = `const __iconData = {\n  name: "arrow-right",\n  node: [\n    ["path", { d: "M5 12h14", key: "1ays0h" }],\n    ["path", { d: "m12 5 7 7-7 7", key: "xquz4c" }]\n  ]\n};`;

    expect(svgOfSource(source)).toBe(ARROW);
  });

  it('reads the older __iconNode constant', () => {
    const source = `const __iconNode = [["path", { "d": "M5 12h14", "key": "a" }], ["path", { "d": "m12 5 7 7-7 7", "key": "b" }]];`;

    expect(svgOfSource(source)).toBe(ARROW);
  });

  it('reads a lucide svelte component', () => {
    const source = `<script lang="ts">import Icon from '../Icon.svelte';\nconst iconNode = [["path", { "d": "M5 12h14" }], ["path", { "d": "m12 5 7 7-7 7" }]];\n</script>`;

    expect(svgOfSource(source)).toBe(ARROW);
  });

  it('keeps every attribute of a shape', () => {
    const source = `const __iconNode = [["rect", { "width": "18", "height": "11", "x": "3", "y": "11", "rx": "2" }]];`;

    expect(svgOfSource(source)).toContain('<rect width="18" height="11" x="3" y="11" rx="2"/>');
  });

  it('has no preview for a module without a node list', () => {
    expect(svgOfSource('export default function Icon() {}')).toBeNull();
  });

  it('has no preview for a node list it cannot read', () => {
    expect(svgOfSource('const __iconNode = [["path", {d: oops}]];')).toBeNull();
  });
});
