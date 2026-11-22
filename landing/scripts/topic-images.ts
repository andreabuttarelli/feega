import { mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import type { CoverShape } from '../src/lib/site/alternatives/cover.ts';
import { baseCss, coverHtml, esc } from './cover-render.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC = resolve(ROOT, 'static');
const WIDTH = 1200;
const HEIGHT = 675;
const MAX_BYTES = 80 * 1024;
const QUALITIES = [82, 74, 66, 58, 50];
const ORANGE = '#ff5100';

type Line = { kind: 'same' | 'add' | 'del'; text: string };

type Cover = { kind: 'cover'; out: string; title: string; sub: string; shape: CoverShape; ramp: string; flag: number };
type Diff = { kind: 'diff'; out: string; file: string; lines: Line[]; note: string };
type Window = { kind: 'window'; out: string; editor: string; file: string; code: string[]; side: string; app: string; panel: [string, string][]; panelTitle: string };

type Spec = Cover | Diff | Window;

const SIZE = { width: WIDTH, height: HEIGHT };

const cover = (s: Cover) => coverHtml(SIZE, { kicker: s.out.startsWith('for/') ? 'Feega for' : 'Feega in', title: s.title, sub: s.sub, shape: s.shape, ramp: s.ramp, flag: s.flag });

const LINE_STYLE: Record<Line['kind'], { mark: string; bg: string; fg: string }> = {
  same: { mark: ' ', bg: 'transparent', fg: 'rgb(255 255 255/.55)' },
  add: { mark: '+', bg: 'rgb(40 200 110/.16)', fg: '#7ee2a8' },
  del: { mark: '-', bg: 'rgb(255 70 70/.16)', fg: '#ff8f8f' }
};

const diff = (s: Diff) => `
<div style="position:relative;width:100%;height:100%;background:#000;padding:56px">
  <div style="position:absolute;inset:0;background:radial-gradient(60% 80% at 100% 0%, rgb(255 81 0/.22), transparent 60%)"></div>
  <div style="position:relative;border:1px solid #222;border-radius:10px;background:#0a0a0a;overflow:hidden;height:100%">
    <div class="mono" style="display:flex;justify-content:space-between;padding:18px 24px;border-bottom:1px solid #1d1d1d;font-size:18px;color:rgb(255 255 255/.7)">
      <span>${esc(s.file)}</span><span style="color:${ORANGE}">written by Feega</span>
    </div>
    <div class="mono" style="padding:20px 0;font-size:21px;line-height:1.75">
      ${s.lines.map((l) => `<div style="display:flex;background:${LINE_STYLE[l.kind].bg};color:${LINE_STYLE[l.kind].fg};padding:0 24px;white-space:pre"><span style="width:28px;opacity:.8">${LINE_STYLE[l.kind].mark}</span><span>${esc(l.text)}</span></div>`).join('')}
    </div>
    <p class="mono" style="position:absolute;left:24px;bottom:20px;font-size:16px;color:rgb(255 255 255/.45)">${esc(s.note)}</p>
  </div>
</div>`;

const window_ = (s: Window) => `
<div style="width:100%;height:100%;background:#000;padding:40px;position:relative">
  <div style="position:absolute;inset:0;background:radial-gradient(50% 70% at 0% 100%, rgb(255 81 0/.18), transparent 60%)"></div>
  <div style="position:relative;height:100%;border:1px solid #222;border-radius:10px;background:#0a0a0a;overflow:hidden;display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #1d1d1d">
      <span style="width:12px;height:12px;border-radius:50%;background:#333"></span><span style="width:12px;height:12px;border-radius:50%;background:#333"></span><span style="width:12px;height:12px;border-radius:50%;background:#333"></span>
      <span class="mono" style="margin-left:16px;font-size:15px;color:rgb(255 255 255/.6)">${esc(s.editor)}</span>
    </div>
    <div style="flex:1;display:grid;grid-template-columns:300px 1fr 250px;min-height:0">
      <div class="mono" style="border-right:1px solid #1d1d1d;padding:18px;font-size:13px;line-height:1.8;color:rgb(255 255 255/.55);overflow:hidden"><p style="color:rgb(255 255 255/.85);margin-bottom:10px">${esc(s.file)}</p><p style="white-space:pre">${s.code.map((c) => esc(c)).join('\n')}</p><p style="margin-top:22px;color:rgb(255 255 255/.85)">${esc(s.side)}</p>
      </div>
      <div style="padding:36px;background:#111">${s.app}</div>
      <div style="border-left:1px solid #1d1d1d;padding:18px">
        <p class="mono" style="font-size:13px;color:${ORANGE};margin-bottom:14px">${esc(s.panelTitle)}</p>
        ${s.panel.map(([k, v]) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #1a1a1a;font-size:15px"><span style="color:rgb(255 255 255/.55)">${esc(k)}</span><span class="mono" style="background:#1a1a1a;border-radius:4px;padding:3px 8px">${esc(v)}</span></div>`).join('')}
      </div>
    </div>
  </div>
</div>`;

const card = (label: string, button: string) => `
<div style="background:#fff;color:#111;border-radius:12px;padding:28px;max-width:420px">
  <p style="font-size:14px;color:#777">${esc(label)}</p>
  <p style="font-size:34px;letter-spacing:-.03em;margin-top:6px">Pro plan</p>
  <p style="font-size:15px;color:#555;margin-top:10px;line-height:1.5">Unlimited projects, team seats and priority support.</p>
  <div style="margin-top:22px;display:inline-block;padding:14px 26px;background:#111;color:#fff;border-radius:8px;outline:2px solid ${ORANGE};outline-offset:4px;position:relative">${esc(button)}<span class="mono" style="position:absolute;left:-2px;top:calc(100% + 10px);background:${ORANGE};color:#000;font-size:12px;padding:3px 7px;border-radius:4px;white-space:nowrap">button · 24 × 14</span></div>
</div>`;

const RENDER: { [K in Spec['kind']]: (s: Extract<Spec, { kind: K }>) => string } = { cover, diff, window: window_ };

const same = (text: string): Line => ({ kind: 'same', text });
const add = (text: string): Line => ({ kind: 'add', text });
const del = (text: string): Line => ({ kind: 'del', text });

const SPECS: Spec[] = [
  { kind: 'cover', out: 'for/react-cover', title: 'React', sub: '.tsx · .jsx · Vite', shape: CoverShape.Orb, ramp: ' .:-=+*#', flag: 0 },
  { kind: 'diff', out: 'for/react-diff', file: 'src/Pricing.tsx', note: 'padding 16 → 24, radius 6 → 8 · one line changed', lines: [same('export function Pricing() {'), same('  return ('), same('    <section className="mx-auto max-w-3xl">'), del('      <button className="p-4 rounded-md bg-black text-white">'), add('      <button className="p-6 rounded-lg bg-black text-white">'), same('        Start free'), same('      </button>'), same('    </section>')] },
  { kind: 'cover', out: 'for/nextjs-cover', title: 'Next.js', sub: 'app/page.tsx · webpack · Turbopack', shape: CoverShape.Diamond, ramp: ' ·•●', flag: 1 },
  { kind: 'diff', out: 'for/nextjs-diff', file: 'app/page.tsx', note: 'font size 36 → 48, tracking tight · server component', lines: [same('export default function Home() {'), same('  return ('), same('    <main className="px-6 py-24">'), del('      <h1 className="text-4xl font-semibold">'), add('      <h1 className="text-5xl font-semibold tracking-tight">'), same('        Ship the page you designed'), same('      </h1>'), same('    </main>')] },
  { kind: 'cover', out: 'for/sveltekit-cover', title: 'SvelteKit', sub: '+page.svelte · <style>', shape: CoverShape.Waves, ramp: ' /\\X', flag: 2 },
  { kind: 'diff', out: 'for/sveltekit-diff', file: 'src/lib/PricingCard.svelte', note: 'CSS mode · class added, rule written in <style>', lines: [del('<div>'), add('<div class="pricing-card-div">'), same('  <h3>{plan.name}</h3>'), same('</div>'), same(''), same('<style>'), add('  .pricing-card-div {'), add('    padding: 24px;'), add('    border-radius: 12px;'), add('  }'), same('</style>')] },
  { kind: 'cover', out: 'for/vue-cover', title: 'Vue', sub: 'PricingCard.vue · <style scoped>', shape: CoverShape.Rings, ramp: ' .oO@', flag: 3 },
  { kind: 'diff', out: 'for/vue-diff', file: 'src/components/PricingCard.vue', note: ':class binding untouched · static class edited', lines: [same('<template>'), del('  <div class="card" :class="{ active }">'), add('  <div class="card pricing-card-div" :class="{ active }">'), same('</template>'), same(''), same('<style scoped>'), add('.pricing-card-div {'), add('  padding: 24px;'), add('  border-radius: 12px;'), add('}'), same('</style>')] },
  { kind: 'cover', out: 'for/tailwind-cover', title: 'Tailwind', sub: 'p-6 · rounded-lg · md:gap-8', shape: CoverShape.Diagonal, ramp: ' -~≈', flag: 4 },
  { kind: 'diff', out: 'for/tailwind-diff', file: 'src/components/Hero.tsx', note: 'one class per edit · colour matched to the brand token', lines: [same('<div'), del('  className="flex items-center gap-4 p-4 md:p-8 bg-[#ff5100]"'), add('  className="flex items-center gap-4 p-6 md:p-8 bg-brand"'), same('>'), same(''), same('/* app.css */'), same('@theme {'), add('  --color-brand: #ff5100;'), same('}')] },
  { kind: 'cover', out: 'integrations/vscode-cover', title: 'VS Code', sub: 'andreabuttarelli.feega · 1.90+', shape: CoverShape.Twin, ramp: ' +x#', flag: 5 },
  { kind: 'cover', out: 'integrations/cursor-cover', title: 'Cursor', sub: 'Open VSX · no tokens per edit', shape: CoverShape.Orb, ramp: ' .oO@', flag: 1 },
  { kind: 'window', out: 'integrations/cursor-window', editor: 'Cursor · agent + Feega', file: 'agent', code: ['> build a pricing card', '  ✓ wrote PricingCard.tsx', '', 'Feega', '  padding 16 → 24', '  no prompt, no tokens'], side: 'Changes · 1', app: card('Built by the agent', 'Upgrade'), panelTitle: 'div.card', panel: [['Padding', '24'], ['Gap', '12'], ['Radius', '12'], ['Shadow', 'none'], ['Layout', 'column']] },
  { kind: 'cover', out: 'integrations/windsurf-cover', title: 'Windsurf', sub: 'Open VSX · next to Cascade', shape: CoverShape.Waves, ramp: ' .:-=+*#', flag: 0 },
  { kind: 'window', out: 'integrations/windsurf-window', editor: 'Windsurf · Feega', file: '+page.svelte', code: ['<section>', '  <h1 class="text-5xl', '    font-semibold', '    tracking-tight">', '    Plans', '  </h1>', '</section>'], side: 'phone 390 · desktop 1440', app: card('Typography', 'Compare plans'), panelTitle: 'h1', panel: [['Size', '48'], ['Weight', '600'], ['Tracking', '-2%'], ['Line', '1.0'], ['Colour', '#111111']] },
  { kind: 'cover', out: 'integrations/vscodium-cover', title: 'VSCodium', sub: 'Open VSX · Apache-2.0', shape: CoverShape.Rings, ramp: ' ·•●', flag: 2 },
  { kind: 'window', out: 'integrations/vscodium-window', editor: 'VSCodium · Feega', file: 'PricingCard.vue', code: ['<template>', '  <button class="btn', '    pricing-card-button">', '    Subscribe', '  </button>', '</template>'], side: 'Changes · 2', app: card('Vue component', 'Subscribe'), panelTitle: 'Changes', panel: [['padding', '24px'], ['radius', '12px'], ['file', '.vue'], ['undo', 'ready'], ['model calls', '0']] }
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });

for (const spec of SPECS) {
  const html = (RENDER[spec.kind] as (s: Spec) => string)(spec);
  await page.setContent(`<!doctype html><html><head><style>${baseCss(SIZE)}</style></head><body>${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: 'png' });
  const file = resolve(STATIC, 'img', `${spec.out}.webp`);
  mkdirSync(dirname(file), { recursive: true });
  for (const quality of QUALITIES) {
    await sharp(png).webp({ quality, effort: 6 }).toFile(file);
    if (statSync(file).size <= MAX_BYTES) {
      break;
    }
  }
  console.log(spec.out, Math.round(statSync(file).size / 1024), 'KB');
}

await browser.close();
