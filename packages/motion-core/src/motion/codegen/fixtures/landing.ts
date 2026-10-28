import { Align, Direction, Justify, Sizing } from '../../layout/auto-layout';
import type { MotionDoc } from '../../doc';
import { box, DocKit } from './kit';

const WIDTH = 1440;
const HEIGHT = 6200;
const GUTTER = 80;
const CONTENT = WIDTH - GUTTER * 2;
const COLUMNS = 12;
const GAP = 24;

const C = {
  ink: '#0e1116',
  body: '#3d4451',
  muted: '#6b7280',
  line: '#e6e8ec',
  paper: '#ffffff',
  wash: '#f6f7f9',
  brand: '#1f5eff',
  brandDeep: '#0b2a8a',
  night: '#0b0f17',
  mint: '#12b981',
  amber: '#f59e0b'
} as const;

const SANS = 'Inter';
const MONO = 'JetBrains Mono';

const fill = { width: Sizing.Fill, height: Sizing.Hug };
const hug = { width: Sizing.Hug, height: Sizing.Hug };

function components(kit: DocKit) {
  kit.component('c-button', 'Button', (b) => {
    b.frame('root', { name: 'Button', box: box(0, 0, 160, 48), fill: C.brand, radius: 10, layout: { direction: Direction.Horizontal, justify: Justify.Center, align: Align.Center, padding: { top: 14, right: 22, bottom: 14, left: 22 } }, item: hug });
    b.text('label', 'Start free trial', { parent: 'root', name: 'Label', size: 15, weight: 600, color: C.paper, leading: 1.2, font: SANS });
  });

  kit.component('c-nav-link', 'Nav link', (n) => {
    n.text('label', 'Product', { name: 'Label', size: 15, weight: 500, color: C.body, leading: 1.5, font: SANS });
  });

  kit.component('c-stat', 'Stat', (s) => {
    s.frame('root', { name: 'Stat', box: box(0, 0, 180, 84), layout: { direction: Direction.Vertical, gap: 6 }, item: hug });
    s.text('label', 'Days to close', { parent: 'root', name: 'Label', size: 13, weight: 500, color: C.muted, font: SANS });
    s.text('value', '3.2', { parent: 'root', name: 'Value', size: 32, weight: 600, color: C.ink, tracking: -0.03, leading: 1.1, font: SANS });
    s.text('delta', '−4.8 days vs. Q1', { parent: 'root', name: 'Delta', size: 13, weight: 500, color: C.mint, font: SANS });
  });

  kit.component('c-task', 'Task row', (t) => {
    t.frame('root', { name: 'Task row', box: box(0, 0, 640, 52), stroke: { color: C.line, width: 1, sides: [0, 0, 1, 0] }, layout: { direction: Direction.Horizontal, align: Align.Center, gap: 16, padding: { top: 14, right: 20, bottom: 14, left: 20 } }, item: { width: Sizing.Fill, height: Sizing.Hug } });
    t.text('task', 'Bank reconciliation — Chase operating', { parent: 'root', name: 'Task', size: 14, weight: 500, color: C.ink, font: SANS, item: { width: Sizing.Fill, height: Sizing.Hug } });
    t.text('owner', 'M. Okafor', { parent: 'root', name: 'Owner', size: 13, color: C.muted, font: SANS });
    t.frame('pill', { name: 'Status pill', parent: 'root', box: box(0, 0, 88, 24), fill: '#e8f8f1', radius: 999, layout: { direction: Direction.Horizontal, align: Align.Center, padding: { top: 4, right: 10, bottom: 4, left: 10 } }, item: hug });
    t.text('status', 'Reconciled', { parent: 'pill', name: 'Status', size: 12, weight: 600, color: '#0e7a55', font: SANS });
  });

  kit.component('c-wordmark', 'Customer logo', (w) => {
    w.text('name', 'Arcadia', { name: 'Name', size: 22, weight: 700, color: '#8a909c', tracking: -0.02, font: SANS });
  });

  kit.component('c-feature', 'Feature card', (f) => {
    f.frame('root', { name: 'Feature card', box: box(0, 0, 410, 240), fill: C.paper, radius: 16, stroke: { color: C.line, width: 1 }, layout: { direction: Direction.Vertical, gap: 14, padding: { top: 32, right: 32, bottom: 32, left: 32 } }, item: { width: Sizing.Fill, height: Sizing.Hug } });
    f.text('index', '01', { parent: 'root', name: 'Index', size: 13, weight: 500, color: C.brand, font: MONO });
    f.text('title', 'Auto-matched reconciliations', { parent: 'root', name: 'Title', size: 22, weight: 600, color: C.ink, tracking: -0.02, leading: 1.25, font: SANS });
    f.text('body', 'Bank feeds land at 6 a.m. and 92% of lines match their ledger entry before anyone logs in.', { parent: 'root', name: 'Body', size: 16, color: C.body, leading: 1.55, font: SANS, item: fill });
  });

  kit.component('c-tier', 'Pricing tier', (p) => {
    p.frame('root', { name: 'Pricing tier', box: box(0, 0, 410, 520), fill: C.paper, radius: 20, stroke: { color: C.line, width: 1 }, layout: { direction: Direction.Vertical, gap: 20, padding: { top: 36, right: 36, bottom: 36, left: 36 } }, item: { width: Sizing.Fill, height: Sizing.Hug } });
    p.text('name', 'Team', { parent: 'root', name: 'Plan', size: 16, weight: 600, color: C.ink, font: SANS });
    p.frame('price-row', { name: 'Price row', parent: 'root', box: box(0, 0, 200, 56), layout: { direction: Direction.Horizontal, gap: 6, align: Align.Baseline }, item: hug });
    p.text('price', '$480', { parent: 'price-row', name: 'Price', size: 48, weight: 600, color: C.ink, tracking: -0.04, leading: 1, font: SANS });
    p.text('period', '/ month', { parent: 'price-row', name: 'Period', size: 15, color: C.muted, font: SANS });
    p.text('pitch', 'For finance teams closing one entity on one ledger.', { parent: 'root', name: 'Pitch', size: 15, color: C.body, leading: 1.5, font: SANS, item: fill });
    p.frame('list', { name: 'Feature list', parent: 'root', box: box(0, 0, 338, 140), layout: { direction: Direction.Vertical, gap: 12 }, item: fill });
    ['Close checklist and task owners', 'Bank and card reconciliation', 'Flux analysis on every account', 'Audit trail export'].forEach((line, i) => p.text(`line-${i + 1}`, `✓  ${line}`, { parent: 'list', name: `Feature ${i + 1}`, size: 15, color: C.body, font: SANS }));
    p.frame('cta', { name: 'Choose button', parent: 'root', box: box(0, 0, 338, 48), fill: C.brand, radius: 10, layout: { direction: Direction.Horizontal, justify: Justify.Center, align: Align.Center, padding: { top: 14, right: 22, bottom: 14, left: 22 } }, item: fill });
    p.text('cta-label', 'Start with Team', { parent: 'cta', name: 'Choose label', size: 15, weight: 600, color: C.paper, leading: 1.2, font: SANS });
  });
}

function nav(kit: DocKit) {
  kit.frame('nav', { name: 'Nav', parent: 'page', box: box(0, 0, WIDTH, 76), stroke: { color: C.line, width: 1, sides: [0, 0, 1, 0] }, layout: { direction: Direction.Horizontal, justify: Justify.SpaceBetween, align: Align.Center, padding: { top: 14, right: GUTTER, bottom: 14, left: GUTTER } }, item: { width: Sizing.Fill, height: Sizing.Hug } });
  kit.text('brand', 'Ledgerline', { parent: 'nav', name: 'Wordmark', size: 20, weight: 700, color: C.ink, tracking: -0.03, font: SANS });
  kit.frame('links', { name: 'Nav links', parent: 'nav', box: box(0, 0, 420, 24), layout: { direction: Direction.Horizontal, gap: 36, align: Align.Center }, item: hug });
  ['Product', 'Pricing', 'Customers', 'Changelog'].forEach((label, i) => kit.instance(`link-${i + 1}`, 'c-nav-link', { parent: 'links', name: `${label} link`, box: box(0, 0, 90, 24), overrides: i ? { label: { text: label } } : undefined }));
  kit.frame('nav-actions', { name: 'Nav actions', parent: 'nav', box: box(0, 0, 260, 48), layout: { direction: Direction.Horizontal, gap: 20, align: Align.Center }, item: hug });
  kit.text('sign-in', 'Sign in', { parent: 'nav-actions', name: 'Sign in', size: 15, weight: 500, color: C.ink, font: SANS, runs: [{ start: 0, end: 7, link: 'https://app.ledgerline.com/login' }] });
  kit.instance('nav-cta', 'c-button', { parent: 'nav-actions', name: 'Nav button', box: box(0, 0, 160, 48) });
}

function hero(kit: DocKit) {
  kit.frame('hero', { name: 'Hero', parent: 'page', box: box(0, 0, WIDTH, 1140), layout: { direction: Direction.Vertical, align: Align.Center, gap: 28, padding: { top: 96, right: GUTTER, bottom: 96, left: GUTTER } }, item: { width: Sizing.Fill, height: Sizing.Hug } });
  kit.frame('badge', { name: 'Announcement', parent: 'hero', box: box(0, 0, 320, 32), fill: '#eef3ff', radius: 999, layout: { direction: Direction.Horizontal, gap: 8, align: Align.Center, padding: { top: 6, right: 14, bottom: 6, left: 14 } }, item: hug });
  kit.text('badge-new', 'New', { parent: 'badge', name: 'Badge tag', size: 13, weight: 700, color: C.brand, font: SANS });
  kit.text('badge-copy', 'Multi-entity close is live for every plan', { parent: 'badge', name: 'Badge copy', size: 13, weight: 500, color: C.brandDeep, font: SANS });
  kit.text('headline', 'Close the month in three days,\nnot three weeks.', { parent: 'hero', name: 'Headline', component: 'Title', size: 72, weight: 600, tracking: -0.045, leading: 1.02, align: 'center', color: C.ink, font: SANS });
  kit.text('lede', 'Ledgerline runs your close checklist, matches every bank line and flags the accounts that moved — so controllers review instead of chase.', { parent: 'hero', name: 'Lede', size: 20, color: C.body, leading: 1.55, align: 'center', font: SANS, box: box(0, 0, 680, 62), item: { width: Sizing.Fixed, height: Sizing.Hug } });
  kit.frame('hero-actions', { name: 'Hero actions', parent: 'hero', box: box(0, 0, 360, 48), layout: { direction: Direction.Horizontal, gap: 12 }, item: hug });
  kit.instance('hero-primary', 'c-button', { parent: 'hero-actions', name: 'Primary button', box: box(0, 0, 160, 48) });
  kit.instance('hero-secondary', 'c-button', { parent: 'hero-actions', name: 'Demo button', box: box(0, 0, 160, 48), overrides: { label: { text: 'Book a 20-min demo', color: C.ink }, root: { fills: [{ type: 'solid', color: C.wash, opacity: 1, visible: true, blend: 'normal' }] } } });
  kit.text('fine', 'Free for 14 days · SOC 2 Type II · Works with NetSuite, Xero and QuickBooks', { parent: 'hero', name: 'Fine print', size: 13, color: C.muted, font: SANS });
  product(kit);
}

function product(kit: DocKit) {
  kit.frame('app', { name: 'Product window', parent: 'hero', box: box(0, 0, CONTENT, 560), fill: C.paper, radius: 18, stroke: { color: C.line, width: 1 }, clip: true, shadow: { y: 24, blur: 64, opacity: 0.14 }, layout: { direction: Direction.Horizontal }, item: { width: Sizing.Fill, height: Sizing.Hug } });
  kit.frame('sidebar', { name: 'Sidebar', parent: 'app', box: box(0, 0, 240, 560), fill: C.wash, layout: { direction: Direction.Vertical, gap: 6, padding: { top: 28, right: 20, bottom: 28, left: 20 } }, item: { width: Sizing.Fixed, height: Sizing.Fill } });
  kit.text('workspace', 'Halcyon Foods, Inc.', { parent: 'sidebar', name: 'Workspace', size: 14, weight: 600, color: C.ink, font: SANS });
  kit.text('period-label', 'September 2026 close', { parent: 'sidebar', name: 'Period', size: 12, color: C.muted, font: SANS });
  ['Overview', 'Checklist', 'Reconciliations', 'Flux review', 'Journal entries', 'Reports'].forEach((item, i) => kit.text(`menu-${i + 1}`, item, { parent: 'sidebar', name: `Menu ${item}`, size: 14, weight: i === 1 ? 600 : 400, color: i === 1 ? C.brand : C.body, font: SANS }));
  kit.frame('main', { name: 'Workspace', parent: 'app', box: box(0, 0, 1040, 560), layout: { direction: Direction.Vertical, gap: 28, padding: { top: 32, right: 40, bottom: 32, left: 40 } }, item: { width: Sizing.Fill, height: Sizing.Hug } });
  kit.frame('main-head', { name: 'Workspace header', parent: 'main', box: box(0, 0, 960, 40), layout: { direction: Direction.Horizontal, justify: Justify.SpaceBetween, align: Align.Center }, item: { width: Sizing.Fill, height: Sizing.Hug } });
  kit.text('main-title', 'Close checklist', { parent: 'main-head', name: 'Workspace title', size: 22, weight: 600, color: C.ink, tracking: -0.02, font: SANS });
  kit.text('main-progress', '41 of 46 tasks done', { parent: 'main-head', name: 'Progress', size: 13, weight: 500, color: C.muted, font: SANS });
  kit.frame('stats', { name: 'Stats', parent: 'main', box: box(0, 0, 960, 84), layout: { direction: Direction.Horizontal, gap: 64 }, item: { width: Sizing.Fill, height: Sizing.Hug } });
  const stats = [
    [null, null, null],
    ['Reconciled', '98.4%', '1,204 of 1,224 lines'],
    ['Open items', '12', '3 need a reviewer'],
    ['Flux > 10%', '7 accounts', 'Explanations due Fri']
  ];
  stats.forEach(([label, value, delta], i) => kit.instance(`stat-${i + 1}`, 'c-stat', { parent: 'stats', name: 'Stat', box: box(0, 0, 180, 84), overrides: label ? { label: { text: label }, value: { text: value }, delta: { text: delta, color: i === 3 ? C.amber : C.muted } } : undefined }));
  kit.frame('tasks', { name: 'Task list', parent: 'main', box: box(0, 0, 960, 270), radius: 12, stroke: { color: C.line, width: 1 }, clip: true, layout: { direction: Direction.Vertical }, item: { width: Sizing.Fill, height: Sizing.Hug } });
  const tasks = [
    [null, null, null],
    ['Accrued payroll — September', 'J. Lindqvist', 'In review'],
    ['Prepaid software amortization', 'A. Romero', 'Reconciled'],
    ['Intercompany — Halcyon UK', 'M. Okafor', 'Blocked'],
    ['Revenue cut-off testing', 'S. Patel', 'In review']
  ];
  const TONE: Record<string, [string, string]> = { 'In review': ['#fff6e5', '#9a5b00'], Blocked: ['#fdecec', '#b42318'], Reconciled: ['#e8f8f1', '#0e7a55'] };
  tasks.forEach(([task, owner, status], i) =>
    kit.instance(`task-${i + 1}`, 'c-task', {
      parent: 'tasks',
      name: 'Task',
      box: box(0, 0, 960, 52),
      item: { width: Sizing.Fill, height: Sizing.Hug },
      overrides: task ? { task: { text: task }, owner: { text: owner }, status: { text: status, color: TONE[status!][1] }, pill: { fills: [{ type: 'solid', color: TONE[status!][0], opacity: 1, visible: true, blend: 'normal' }] } } : undefined
    })
  );
}

function logos(kit: DocKit) {
  kit.frame('logos', { name: 'Logos', parent: 'page', box: box(0, 0, WIDTH, 180), layout: { direction: Direction.Vertical, align: Align.Center, gap: 28, padding: { top: 24, right: GUTTER, bottom: 72, left: GUTTER } }, item: { width: Sizing.Fill, height: Sizing.Hug } });
  kit.text('logos-title', 'Controllers at 1,400 companies close with Ledgerline', { parent: 'logos', name: 'Logos title', size: 14, weight: 500, color: C.muted, font: SANS });
  kit.frame('logo-row', { name: 'Logo row', parent: 'logos', box: box(0, 0, CONTENT, 32), layout: { direction: Direction.Horizontal, justify: Justify.SpaceBetween, align: Align.Center }, item: { width: Sizing.Fill, height: Sizing.Hug } });
  ['Arcadia', 'Northbeam', 'Halcyon', 'Polar & Co', 'Meridian', 'Fieldwork'].forEach((name, i) => kit.instance(`logo-${i + 1}`, 'c-wordmark', { parent: 'logo-row', name: 'Customer logo', box: box(0, 0, 160, 32), overrides: i ? { name: { text: name } } : undefined }));
}

function features(kit: DocKit) {
  kit.frame('features', { name: 'Features', parent: 'page', box: box(0, 0, WIDTH, 900), fill: C.wash, layout: { direction: Direction.Vertical, gap: 56, padding: { top: 120, right: GUTTER, bottom: 120, left: GUTTER } }, item: { width: Sizing.Fill, height: Sizing.Hug } });
  kit.frame('features-head', { name: 'Features heading', parent: 'features', box: box(0, 0, 720, 160), layout: { direction: Direction.Vertical, gap: 16 }, item: { width: Sizing.Fixed, height: Sizing.Hug } });
  kit.text('features-kicker', 'THE CLOSE, END TO END', { parent: 'features-head', name: 'Eyebrow', component: 'Kicker', size: 13, weight: 600, tracking: 0.08, color: C.brand, font: MONO });
  kit.text('features-title', 'Every step of month-end in one place your auditors can read.', { parent: 'features-head', name: 'Section title', size: 44, weight: 600, tracking: -0.035, leading: 1.1, color: C.ink, font: SANS, item: fill });
  kit.frame('feature-grid', { name: 'Feature grid', parent: 'features', box: box(0, 0, CONTENT, 520), layout: { direction: Direction.Grid, columns: COLUMNS, gap: GAP, crossGap: GAP }, item: { width: Sizing.Fill, height: Sizing.Hug } });
  const cards = [
    null,
    ['02', 'A checklist that assigns itself', 'Recurring tasks roll forward with owners, due dates and the evidence from last month attached.'],
    ['03', 'Flux analysis without pivot tables', 'Accounts that moved more than your threshold are flagged with the journal entries behind them.'],
    ['04', 'Intercompany that nets out', 'Matching entries across entities are paired automatically; the leftovers get a named owner.'],
    ['05', 'Audit-ready by construction', 'Every sign-off, comment and attachment is timestamped and exports as one PDF binder.'],
    ['06', 'Your ledger stays the source', 'Two-way sync with NetSuite, Xero and QuickBooks Online. No CSV ever leaves a laptop.']
  ];
  cards.forEach((card, i) => kit.instance(`feature-${i + 1}`, 'c-feature', { parent: 'feature-grid', name: 'Feature', box: box(0, 0, 410, 240), item: { width: Sizing.Fill, height: Sizing.Hug, columnSpan: 4 }, overrides: card ? { index: { text: card[0] }, title: { text: card[1] }, body: { text: card[2] } } : undefined }));
}

function testimonial(kit: DocKit) {
  kit.frame('testimonial', { name: 'Testimonial', parent: 'page', box: box(0, 0, WIDTH, 560), layout: { direction: Direction.Vertical, align: Align.Center, gap: 40, padding: { top: 128, right: 240, bottom: 128, left: 240 } }, item: { width: Sizing.Fill, height: Sizing.Hug } });
  kit.text('quote', '“We used to lose the second week of every month to tick-and-tie. Our September close took three days, and the auditors asked for nothing we didn’t already have.”', { parent: 'testimonial', name: 'Quote', size: 34, weight: 500, tracking: -0.02, leading: 1.35, align: 'center', color: C.ink, font: SANS, item: fill });
  kit.frame('person', { name: 'Attribution', parent: 'testimonial', box: box(0, 0, 320, 48), layout: { direction: Direction.Horizontal, gap: 14, align: Align.Center }, item: hug });
  kit.frame('avatar', { name: 'Avatar', parent: 'person', box: box(0, 0, 48, 48), fill: '#dbe5ff', radius: 24, layout: { direction: Direction.Horizontal, justify: Justify.Center, align: Align.Center }, item: { width: Sizing.Fixed, height: Sizing.Fixed } });
  kit.text('initials', 'DR', { parent: 'avatar', name: 'Initials', size: 15, weight: 700, color: C.brandDeep, font: SANS });
  kit.frame('who', { name: 'Person', parent: 'person', box: box(0, 0, 240, 44), layout: { direction: Direction.Vertical, gap: 2 }, item: hug });
  kit.text('who-name', 'Dana Reyes', { parent: 'who', name: 'Name', size: 16, weight: 600, color: C.ink, font: SANS });
  kit.text('who-role', 'Corporate Controller, Halcyon Foods', { parent: 'who', name: 'Role', size: 14, color: C.muted, font: SANS });
}

function pricing(kit: DocKit) {
  kit.frame('pricing', { name: 'Pricing', parent: 'page', box: box(0, 0, WIDTH, 900), fill: C.wash, layout: { direction: Direction.Vertical, align: Align.Center, gap: 56, padding: { top: 120, right: GUTTER, bottom: 120, left: GUTTER } }, item: { width: Sizing.Fill, height: Sizing.Hug } });
  kit.text('pricing-title', 'Priced per entity, not per seat', { parent: 'pricing', name: 'Pricing title', size: 44, weight: 600, tracking: -0.035, leading: 1.1, align: 'center', color: C.ink, font: SANS });
  kit.frame('tiers', { name: 'Tiers', parent: 'pricing', box: box(0, 0, CONTENT, 540), layout: { direction: Direction.Grid, columns: COLUMNS, gap: GAP, crossGap: GAP }, item: { width: Sizing.Fill, height: Sizing.Hug } });
  const tiers = [
    null,
    { name: 'Growth', price: '$1,200', pitch: 'For groups closing up to five entities with intercompany.', cta: 'Start with Growth', fill: C.night, ink: C.paper, body: '#c4cad6' },
    { name: 'Enterprise', price: 'Custom', pitch: 'For multi-ledger groups with SSO, SCIM and a named close lead.', cta: 'Talk to sales' }
  ];
  tiers.forEach((t, i) => {
    const overrides = t
      ? {
          name: { text: t.name, ...(t.ink ? { color: t.ink } : {}) },
          price: { text: t.price, ...(t.ink ? { color: t.ink } : {}) },
          pitch: { text: t.pitch, ...(t.body ? { color: t.body } : {}) },
          ...(t.body ? Object.fromEntries([1, 2, 3, 4].map((n) => [`line-${n}`, { color: t.body }])) : {}),
          ...(t.fill ? { root: { fills: [{ type: 'solid', color: t.fill, opacity: 1, visible: true, blend: 'normal' }] } } : {}),
          'cta-label': { text: t.cta }
        }
      : undefined;
    kit.instance(`tier-${i + 1}`, 'c-tier', { parent: 'tiers', name: 'Tier', box: box(0, 0, 410, 520), item: { width: Sizing.Fill, height: Sizing.Hug, columnSpan: 4 }, overrides });
  });
}

function cta(kit: DocKit) {
  kit.frame('cta', { name: 'CTA', parent: 'page', box: box(0, 0, WIDTH, 420), fill: C.night, layout: { direction: Direction.Vertical, align: Align.Center, gap: 28, padding: { top: 112, right: GUTTER, bottom: 112, left: GUTTER } }, item: { width: Sizing.Fill, height: Sizing.Hug } });
  kit.text('cta-title', 'Your next close can be the short one.', { parent: 'cta', name: 'CTA title', size: 52, weight: 600, tracking: -0.04, leading: 1.08, align: 'center', color: C.paper, font: SANS });
  kit.text('cta-copy', 'Connect your ledger in an afternoon. Keep the checklist you already have.', { parent: 'cta', name: 'CTA copy', size: 18, color: '#c4cad6', align: 'center', font: SANS });
  kit.instance('cta-button', 'c-button', { parent: 'cta', name: 'CTA button', box: box(0, 0, 160, 48) });
}

function footer(kit: DocKit) {
  kit.frame('footer', { name: 'Footer', parent: 'page', box: box(0, 0, WIDTH, 360), layout: { direction: Direction.Vertical, gap: 56, padding: { top: 72, right: GUTTER, bottom: 48, left: GUTTER } }, item: { width: Sizing.Fill, height: Sizing.Hug } });
  kit.frame('footer-grid', { name: 'Footer columns', parent: 'footer', box: box(0, 0, CONTENT, 180), layout: { direction: Direction.Grid, columns: COLUMNS, gap: GAP, crossGap: GAP }, item: { width: Sizing.Fill, height: Sizing.Hug } });
  kit.frame('footer-brand', { name: 'Footer brand', parent: 'footer-grid', box: box(0, 0, 400, 120), layout: { direction: Direction.Vertical, gap: 12 }, item: { width: Sizing.Fill, height: Sizing.Hug, columnSpan: 6 } });
  kit.text('footer-mark', 'Ledgerline', { parent: 'footer-brand', name: 'Footer wordmark', size: 18, weight: 700, color: C.ink, tracking: -0.03, font: SANS });
  kit.text('footer-pitch', 'The close platform for finance teams that would rather review than reconcile.', { parent: 'footer-brand', name: 'Footer pitch', size: 14, color: C.muted, leading: 1.6, font: SANS, box: box(0, 0, 320, 44), item: { width: Sizing.Fixed, height: Sizing.Hug } });
  const columns: [string, string[]][] = [
    ['Product', ['Checklist', 'Reconciliations', 'Flux review', 'Integrations']],
    ['Company', ['About', 'Customers', 'Careers', 'Security']],
    ['Resources', ['Close guide', 'Changelog', 'Status', 'Contact']]
  ];
  columns.forEach(([title, links], c) => {
    kit.frame(`col-${c + 1}`, { name: `${title} links`, parent: 'footer-grid', box: box(0, 0, 200, 160), layout: { direction: Direction.Vertical, gap: 12 }, item: { width: Sizing.Fill, height: Sizing.Hug, columnSpan: 2 } });
    kit.text(`col-${c + 1}-title`, title, { parent: `col-${c + 1}`, name: `${title} heading`, size: 13, weight: 600, color: C.ink, font: SANS });
    links.forEach((label, l) => kit.text(`col-${c + 1}-${l + 1}`, label, { parent: `col-${c + 1}`, name: label, size: 14, color: C.muted, font: SANS, runs: [{ start: 0, end: [...label].length, link: `https://ledgerline.com/${label.toLowerCase().replace(/\s+/g, '-')}` }] }));
  });
  kit.frame('legal', { name: 'Legal', parent: 'footer', box: box(0, 0, CONTENT, 40), stroke: { color: C.line, width: 1, sides: [1, 0, 0, 0] }, layout: { direction: Direction.Horizontal, justify: Justify.SpaceBetween, padding: { top: 24, right: 0, bottom: 0, left: 0 } }, item: { width: Sizing.Fill, height: Sizing.Hug } });
  kit.text('copyright', '© 2026 Ledgerline, Inc.', { parent: 'legal', name: 'Copyright', size: 13, color: C.muted, font: SANS });
  kit.text('legal-links', 'Privacy · Terms · DPA', { parent: 'legal', name: 'Legal links', size: 13, color: C.muted, font: SANS });
}

export function landingDoc(): MotionDoc {
  const kit = new DocKit(WIDTH, HEIGHT);
  components(kit);
  kit.frame('page', { name: 'Ledgerline landing', box: box(0, 0, WIDTH, HEIGHT), fill: C.paper, layout: { direction: Direction.Vertical }, item: { width: Sizing.Fixed, height: Sizing.Hug } });
  nav(kit);
  hero(kit);
  logos(kit);
  features(kit);
  testimonial(kit);
  pricing(kit);
  cta(kit);
  footer(kit);
  return kit.doc();
}

export const LANDING_ASSETS: Record<string, string> = {};
