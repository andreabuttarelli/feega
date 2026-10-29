import { Direction, Justify, Align, Sizing } from '../../layout/auto-layout';
import { box, DocKit } from './kit';

const INK = '#0b1220';
const MUTED = '#5b6474';
const BRAND = '#4f46e5';
const PAPER = '#ffffff';

function button(kit: DocKit) {
  return kit.component('cmp-button', 'Button', (b) => {
    b.frame('btn', { name: 'Button', box: box(0, 0, 140, 44), fill: BRAND, radius: 8, layout: { direction: Direction.Horizontal, justify: Justify.Center, align: Align.Center, padding: { top: 12, right: 20, bottom: 12, left: 20 } } });
    b.text('btn-label', 'Get started', { parent: 'btn', name: 'Label', size: 15, weight: 600, color: PAPER, leading: 1.2 });
  });
}

export function heroDoc() {
  const kit = new DocKit(1280, 720);
  button(kit);
  kit.frame('page', { name: 'Landing', box: box(0, 0, 1280, 720), fill: PAPER, layout: { direction: Direction.Vertical, gap: 64, padding: { top: 24, right: 80, bottom: 96, left: 80 } } });
  kit.frame('nav', { name: 'Nav', parent: 'page', box: box(80, 24, 1120, 44), layout: { direction: Direction.Horizontal, justify: Justify.SpaceBetween, align: Align.Center }, item: { width: Sizing.Fill } });
  kit.text('logo', 'Northwind', { parent: 'nav', name: 'Wordmark', size: 20, weight: 700, color: INK });
  kit.instance('nav-cta', 'cmp-button', { parent: 'nav', name: 'Nav CTA', box: box(1060, 24, 140, 44) });
  kit.frame('hero', { name: 'Hero', parent: 'page', box: box(80, 132, 1120, 400), layout: { direction: Direction.Vertical, gap: 24, align: Align.Center }, item: { width: Sizing.Fill } });
  kit.text('headline', 'Ship the release notes\nyour customers read', { parent: 'hero', name: 'Headline', component: 'Title', size: 64, weight: 600, leading: 1.05, tracking: -0.04, align: 'center', color: INK });
  kit.text('sub', 'Northwind turns merged pull requests into a changelog, an email and an in-app banner.', { parent: 'hero', name: 'Subtitle', size: 20, color: MUTED, align: 'center', item: { width: Sizing.Fixed, height: Sizing.Hug }, box: box(340, 300, 600, 60) });
  kit.frame('actions', { name: 'Actions', parent: 'hero', box: box(500, 400, 300, 44), layout: { direction: Direction.Horizontal, gap: 12 }, item: { width: Sizing.Hug, height: Sizing.Hug } });
  kit.instance('primary', 'cmp-button', { parent: 'actions', name: 'Primary', box: box(500, 400, 140, 44), overrides: { 'btn-label': { text: 'Start free' } } });
  kit.instance('secondary', 'cmp-button', { parent: 'actions', name: 'Secondary', box: box(652, 400, 140, 44), overrides: { 'btn-label': { text: 'Book a demo' } } });
  return kit.doc();
}

export function featureGridDoc() {
  const kit = new DocKit(1200, 520);
  kit.component('cmp-card', 'Feature card', (c) => {
    c.frame('card', { name: 'Card', box: box(0, 0, 360, 220), fill: '#f6f7f9', radius: 16, layout: { direction: Direction.Vertical, gap: 12, padding: { top: 28, right: 28, bottom: 28, left: 28 } } });
    c.vector('icon', 'M0.1 0.5 L0.5 0.1 L0.9 0.5 L0.5 0.9 Z', { parent: 'card', name: 'Icon', box: box(28, 28, 32, 32), fill: BRAND });
    c.text('title', 'Fast by default', { parent: 'card', name: 'Title', size: 20, weight: 600, color: INK });
    c.text('body', 'Every page is static until it needs not to be.', { parent: 'card', name: 'Body', size: 15, color: MUTED, item: { width: Sizing.Fill, height: Sizing.Hug } });
  });
  kit.frame('features', { name: 'Features', box: box(0, 0, 1200, 520), fill: '#ffffff', layout: { direction: Direction.Grid, columns: 3, gap: 24, crossGap: 24, padding: { top: 40, right: 0, bottom: 40, left: 0 } } });
  const copy = [
    ['Fast by default', 'Every page is static until it needs not to be.'],
    ['Typed content', 'Schemas catch a missing field before the deploy does.'],
    ['Preview links', 'Each branch gets a URL your reviewer can open on a phone.']
  ];
  copy.forEach(([title, body], i) => kit.instance(`card-${i + 1}`, 'cmp-card', { parent: 'features', name: 'Feature', box: box(i * 384, 40, 360, 220), overrides: i ? { title: { text: title }, body: { text: body } } : undefined }));
  return kit.doc();
}

export function absoluteDoc() {
  const kit = new DocKit(800, 400);
  kit.frame('poster', { name: 'Poster', box: box(0, 0, 800, 400), fill: '#111827' });
  kit.frame('badge', { name: 'Badge', parent: 'poster', box: box(600, 40, 160, 48), fill: BRAND, radius: 24 });
  kit.text('caption', 'Limited run', { parent: 'poster', name: 'Caption', size: 18, color: PAPER, box: box(40, 320, 300, 30) });
  return kit.doc();
}

export function variantsDoc() {
  const kit = new DocKit(800, 200);
  const shaped = (compId: string, fill: string) =>
    kit.component(compId, 'Button', (b) => {
      b.frame(`${compId}-box`, { name: 'Button', box: box(0, 0, 140, 44), fill, radius: 8, layout: { direction: Direction.Horizontal, justify: Justify.Center, align: Align.Center, padding: { top: 12, right: 20, bottom: 12, left: 20 } } });
      b.text(`${compId}-label`, 'Save', { parent: `${compId}-box`, name: 'Label', size: 15, weight: 600, color: INK });
    });
  shaped('cmp-default', BRAND);
  shaped('cmp-outline', PAPER);
  kit.frame('row', { name: 'Toolbar', box: box(0, 0, 800, 200), fill: PAPER, layout: { direction: Direction.Horizontal, gap: 12, padding: { top: 40, right: 40, bottom: 40, left: 40 } } });
  kit.instance('save', 'cmp-default', { parent: 'row', name: 'Save', box: box(40, 40, 140, 44) });
  kit.instance('cancel', 'cmp-outline', { parent: 'row', name: 'Cancel', box: box(192, 40, 140, 44), overrides: { 'cmp-outline-label': { text: 'Cancel' } } });
  const doc = kit.doc();
  const variant = (compId: string, value: string) => ({ ...doc.comps[compId], component: { name: 'Button', set: 'Button', variant: { variant: value }, properties: { children: { kind: 'text' as const, target: `${compId}-label`, default: 'Save' } } } });
  return { ...doc, comps: { ...doc.comps, 'cmp-default': variant('cmp-default', 'Default'), 'cmp-outline': variant('cmp-outline', 'outline') } };
}
