import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { svgOfModule, svgOfSource } from './icon-node';

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

const HEROICON = `const React = require("react");
function ArrowRightIcon({ title, titleId, ...props }, svgRef) {
  return /*#__PURE__*/React.createElement("svg", Object.assign({
    xmlns: "http://www.w3.org/2000/svg",
    fill: "none",
    viewBox: "0 0 24 24",
    strokeWidth: 1.5,
    stroke: "currentColor",
    "aria-hidden": "true",
    ref: svgRef,
    "aria-labelledby": titleId
  }, props), title ? /*#__PURE__*/React.createElement("title", {
    id: titleId
  }, title) : null, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: "M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
  }));
}`;

const PHOSPHOR = `import * as e from "react";
const a = new Map([
  ["bold", e.createElement(e.Fragment, null, e.createElement("path", { d: "BOLD" }))],
  ["regular", e.createElement(e.Fragment, null, e.createElement("path", { d: "M221.66,133.66l-72,72" }), e.createElement("path", { d: "M2,3", opacity: "0.2" }))],
  ["thin", e.createElement(e.Fragment, null, e.createElement("path", { d: "THIN" }))]
]);
export { a as default };`;

describe('svgOfSource on other package shapes', () => {
  it('reads the quoted node key of @lucide/svelte', () => {
    const source = `<script module lang="ts">export const __iconData = { "name": "arrow-right", "size": 24, "node": [["path", { "d": "M5 12h14" }], ["path", { "d": "m12 5 7 7-7 7" }]] };\nexport const __iconNode = __iconData.node;\n</script>`;

    expect(svgOfSource(source)).toBe(ARROW);
  });

  it('reads the createElement calls of a heroicons module with its own stroke width', () => {
    const svg = svgOfSource(HEROICON)!;

    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('stroke-width="1.5"');
    expect(svg).toContain('<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/>');
    expect(svg).not.toContain('<title');
  });

  it('reads the regular weight of a phosphor definition, filled', () => {
    const svg = svgOfSource(PHOSPHOR)!;

    expect(svg).toContain('viewBox="0 0 256 256"');
    expect(svg).toContain('fill="currentColor"');
    expect(svg).toContain('<path d="M221.66,133.66l-72,72"/>');
    expect(svg).not.toContain('BOLD');
    expect(svg).not.toContain('THIN');
  });
});

function modules(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'icon-module-'));
  Object.entries(files).forEach(([file, text]) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  });
  return root;
}

describe('svgOfModule', () => {
  it('follows an alias that re-exports another module', async () => {
    const root = modules({
      'icons/activity-square.mjs': `export { default } from './square-activity.mjs';`,
      'icons/square-activity.mjs': `const __iconData = { node: [["path", { d: "M5 12h14" }], ["path", { d: "m12 5 7 7-7 7" }]] };`
    });

    expect(await svgOfModule(join(root, 'icons/activity-square.mjs'))).toBe(ARROW);
  });

  it('follows the definition a phosphor component imports, not the base it also imports', async () => {
    const root = modules({
      'csr/Arrow.es.js': `import a from "../lib/IconBase.es.js";\nimport i from "../defs/Arrow.es.js";`,
      'lib/IconBase.es.js': `export default function IconBase() {}`,
      'defs/Arrow.es.js': PHOSPHOR
    });

    expect(await svgOfModule(join(root, 'csr/Arrow.es.js'))).toContain('M221.66,133.66l-72,72');
  });

  it('gives up on a cycle and on a missing file', async () => {
    const root = modules({ 'a.mjs': `export { default } from './b.mjs';`, 'b.mjs': `export { default } from './a.mjs';` });

    expect(await svgOfModule(join(root, 'a.mjs'))).toBeNull();
    expect(await svgOfModule(join(root, 'missing.mjs'))).toBeNull();
  });
});
