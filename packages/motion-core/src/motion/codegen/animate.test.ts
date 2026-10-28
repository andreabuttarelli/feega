import { describe, expect, it } from 'vitest';
import { parseMotionDoc } from '../doc';
import { CodeTarget, exportCode, type CodeExport } from './index';
import { entranceDoc, hoverDoc, loopDoc, springDoc } from './fixtures/motion';

const file = (out: CodeExport, path: string) => {
  const found = out.files.find((f) => f.path === path);
  if (!found) {
    throw new Error(`${path} is not in ${out.files.map((f) => f.path).join(', ')}`);
  }
  return found.content;
};

const html = (doc: ReturnType<typeof entranceDoc>) => exportCode(doc, { name: 'Launch', target: CodeTarget.Html });
const react = (doc: ReturnType<typeof entranceDoc>) => exportCode(doc, { name: 'Launch' });
const svelte = (doc: ReturnType<typeof entranceDoc>) => exportCode(doc, { name: 'Launch', target: CodeTarget.Svelte });

describe('the motion fixtures', () => {
  it('are valid designs', () => {
    for (const doc of [entranceDoc(), springDoc(), loopDoc(), hoverDoc()]) {
      expect(parseMotionDoc(doc).ok).toBe(true);
    }
  });
});

describe('a fade and rise entrance with a bezier', () => {
  it('becomes CSS keyframes with the exact curve, delay and duration', () => {
    const out = html(entranceDoc());
    const css = file(out, 'styles/animations.css');
    expect(file(out, 'index.html')).toContain('href="styles/animations.css"');
    expect(css).toContain('@keyframes headline-opacity {');
    expect(css).toContain('animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);');
    expect(css).toContain('headline-opacity 0.6s linear 0.2s 1 both');
    expect(css).toContain('@keyframes headline-y {');
    expect(css).toContain('--ty: 28.8px;');
    expect(css).toContain('translate: var(--tx, 0px) var(--ty, 0px);');
    expect(css).toContain("@property --ty { syntax: '<length>'; inherits: false; initial-value: 0px; }");
  });

  it('becomes a Motion component in React', () => {
    const out = react(entranceDoc());
    const anims = file(out, 'src/animations.ts');
    expect(anims).toContain('export const launchHeadline: MotionProps = {');
    expect(anims).toContain('initial: { opacity: 0, y: 28.8 }');
    expect(anims).toContain('animate: { opacity: [0, 1], y: [28.8, 0] }');
    expect(anims).toContain('opacity: { duration: 0.6, delay: 0.2, times: [0, 1], ease: [[0.16, 1, 0.3, 1]] }');
    const page = file(out, 'src/pages/Launch.tsx');
    expect(page).toContain("import { motion } from 'motion/react';");
    expect(page).toMatch(/<motion\.h1 \{\.\.\.launchHeadline\} className=/);
    expect(JSON.parse(file(out, 'package.json')).dependencies.motion).toBeDefined();
  });

  it('keeps the keyframes inside the Svelte component style', () => {
    const page = file(svelte(entranceDoc()), 'src/routes/+page.svelte');
    expect(page).toContain('@keyframes headline-opacity {');
    expect(page).toContain('animation: headline-opacity 0.6s linear 0.2s 1 both');
  });

  it('is not exported when the design has none', () => {
    const doc = entranceDoc();
    doc.tracks.forEach((t) => t.clips.forEach((c) => (c.keyframes = {})));
    expect(html(doc).files.map((f) => f.path)).not.toContain('styles/animations.css');
    expect(file(react(doc), 'package.json')).not.toContain('motion');
  });
});

describe('a spring scale', () => {
  it('samples the spring into linear() in CSS', () => {
    const css = file(html(springDoc()), 'styles/animations.css');
    expect(css).toMatch(/animation-timing-function: linear\(0, [^)]*1\);/);
    expect(css).toContain('scale: 0.6;');
  });

  it('uses the same samples as an easing function in React', () => {
    const out = react(springDoc());
    expect(file(out, 'src/animations.ts')).toMatch(/ease: \[sampled\(\[0, [^\]]*1\]\)\]/);
    expect(file(out, 'src/lib/easing.ts')).toContain('export const sampled');
  });
});

describe('a looping keyframe sequence', () => {
  it('repeats over the work area in CSS', () => {
    const css = file(html(loopDoc()), 'styles/animations.css');
    expect(css).toContain('live-dot-opacity 1s linear 0s infinite both');
    expect(css).toMatch(/33\.333% \{\n\s+opacity: 0\.2;/);
    expect(css).toMatch(/66\.667% \{\n\s+opacity: 1;/);
  });

  it('repeats forever in React', () => {
    expect(file(react(loopDoc()), 'src/animations.ts')).toContain('repeat: Infinity');
  });
});

describe('a hover trigger', () => {
  it('plays on :hover in CSS', () => {
    const css = file(html(hoverDoc()), 'styles/animations.css');
    expect(css).toContain('.cta:hover {');
    expect(css).toContain('animation-timing-function: cubic-bezier(0.2, 0, 0, 1);');
  });

  it('becomes whileHover in React', () => {
    const anims = file(react(hoverDoc()), 'src/animations.ts');
    expect(anims).toContain('whileHover: { scale: [1, 1.06] }');
    expect(anims).not.toContain('animate:');
  });
});
