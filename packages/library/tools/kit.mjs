export const ICONS = {
  mark: ['..#..', '.###.', '#####', '.###.', '..#..'],
  cursor: ['#.......', '##......', '###.....', '####....', '#####...', '######..', '###.....', '#..##...', '....##..'],
  grid: ['###.###', '###.###', '###.###', '.......', '###.###', '###.###', '###.###'],
  lock: ['..####..', '.##..##.', '.#....#.', '########', '###..###', '###..###', '########', '########'],
  check: ['.......#', '......##', '#....##.', '##..##..', '.####...', '..##....'],
  plus: ['..##..', '..##..', '######', '######', '..##..', '..##..'],
  spark: ['...#...', '...#...', '..###..', '#######', '..###..', '...#...', '...#...'],
  chat: ['########', '#......#', '#.##.#.#', '#......#', '########', '.##.....', '.#......'],
  inbox: ['.########.', '.#......#.', '#........#', '#........#', '####..####', '#..####..#', '#........#', '##########'],
  bell: ['...##...', '..####..', '.######.', '.######.', '.######.', '########', '........', '...##...'],
  user: ['..####..', '..####..', '..####..', '........', '.######.', '########', '########'],
  search: ['.####..', '#....#.', '#....#.', '#....#.', '.####..', '.....#.', '......#'],
  home: ['...##...', '..####..', '.######.', '########', '.##..##.', '.##..##.', '.##..##.'],
  chart: ['......##', '......##', '...##.##', '...##.##', '##.##.##', '##.##.##'],
  close: ['#....#', '.#..#.', '..##..', '..##..', '.#..#.', '#....#'],
  arrow: ['....#..', '.....#.', '#######', '.....#.', '....#..'],
  bolt: ['....##', '...##.', '..##..', '.#####', '...##.', '..##..', '.##...'],
  layers: ['...#....#...', '..##...##...', '.##...##..##', '##...##....#', '.##.##...##.', '..###...##..', '...#....#...'],
  warn: ['....#....', '...###...', '..##.##..', '..##.##..', '.###.###.', '.#######.', '####.####', '#########'],
  menu: ['######', '......', '######', '......', '######'],
  quote: ['##..##', '##..##', '.#...#', '#...#.'],
  gear: ['..#..#..', '.######.', '##....##', '.#.##.#.', '.#.##.#.', '##....##', '.######.', '..#..#..'],
  dots: ['#.#.#'],
  play: ['#....', '###..', '#####', '###..', '#....'],
  mail: ['########', '##....##', '#.#..#.#', '#..##..#', '#......#', '########'],
  chevron: ['#...#', '.#.#.', '..#..'],
  globe: ['..###..', '.#.#.#.', '#######', '#..#..#', '#######', '.#.#.#.', '..###..'],
  star: ['...#...', '..###..', '#######', '.#####.', '.##.##.', '.#...#.'],
  clock: ['.#####.', '#..#..#', '#..#..#', '#..##.#', '#.....#', '.#####.'],
  plug: ['.#..#.', '.#..#.', '######', '######', '.####.', '..##..', '..##..'],
  file: ['####..', '#..##.', '#...##', '#....#', '#....#', '######'],
  image: ['########', '#......#', '#.##...#', '#....#.#', '#...####', '########'],
  term: ['#.....', '.#....', '..#...', '.#....', '#..###']
};

export function px(name, cls = 'fl-px') {
  const rows = ICONS[name];
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  let d = '';
  rows.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c === '#') {
        d += `M${x} ${y}h1v1h-1z`;
      }
    });
  });
  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" /></svg>`;
}

export function root(c) {
  return [
    `.${c}{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}`,
    `:where(.${c}) *,:where(.${c}) *::before,:where(.${c}) *::after{box-sizing:border-box}`,
    `:where(.${c}) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}`,
    `:where(.${c}) a{color:inherit;text-decoration:none}`,
    `:where(.${c}) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}`
  ];
}

export const MOD = {
  container: [
    '.fl-container{width:min(var(--feega-max-width),100% - 2 * var(--feega-gutter));margin-inline:auto}'
  ],
  px: [
    '.fl-px{display:block;flex:none;width:1em;height:auto;fill:currentColor;shape-rendering:crispEdges}'
  ],
  btn: [
    '.fl-btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--feega-space-2);min-height:44px;padding:0 var(--feega-space-6);border:1px solid var(--feega-line-strong);border-radius:var(--feega-radius-full);background:transparent;color:var(--feega-fg);font:inherit;font-size:0.9375rem;font-weight:500;letter-spacing:var(--feega-tracking);white-space:nowrap;text-decoration:none;cursor:pointer;transition:background-color var(--feega-dur-fast) var(--feega-ease),border-color var(--feega-dur-fast) var(--feega-ease),color var(--feega-dur-fast) var(--feega-ease),transform var(--feega-dur-fast) var(--feega-ease)}',
    '.fl-btn:hover{border-color:var(--feega-fg-subtle);background:var(--feega-surface)}',
    '.fl-btn:active{transform:scale(0.97)}',
    '.fl-btn--primary{border-color:var(--feega-accent);background:var(--feega-accent);color:var(--feega-accent-fg)}',
    '.fl-btn--primary:hover{border-color:var(--feega-accent-hover);background:var(--feega-accent-hover)}',
    '.fl-btn--ink{border-color:var(--feega-fg);background:var(--feega-fg);color:var(--feega-bg)}',
    '.fl-btn--ink:hover{border-color:var(--feega-fg-muted);background:var(--feega-fg-muted)}',
    '.fl-btn--ghost{border-color:transparent}',
    '.fl-btn--sm{min-height:36px;padding:0 var(--feega-space-4);font-size:var(--feega-text-sm)}',
    '.fl-btn .fl-px{width:10px;transition:transform var(--feega-dur) var(--feega-ease)}',
    '.fl-btn:hover .fl-px{transform:translateX(3px)}',
    '.fl-btn[disabled]{opacity:0.45;cursor:not-allowed}'
  ],
  type: [
    '.fl-title{font-family:var(--feega-font-display);font-size:var(--feega-text-title);font-weight:500;line-height:0.95;letter-spacing:var(--feega-tracking-tight);text-wrap:balance}',
    '.fl-lead{max-width:34rem;font-size:var(--feega-text-lg);line-height:1.4;color:var(--feega-fg-muted);text-wrap:pretty}',
    '.fl-eyebrow{display:inline-flex;align-items:center;gap:var(--feega-space-2);font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);letter-spacing:0.02em;color:var(--feega-fg-muted);text-transform:uppercase}',
    '.fl-eyebrow::before{content:"";width:6px;height:6px;background:var(--feega-accent)}'
  ],
  dots: [
    '.fl-dots{background-image:radial-gradient(var(--feega-dot) 1px,transparent 1.5px);background-size:14px 14px}'
  ],
  field: [
    '.fl-field{display:grid;gap:var(--feega-space-2);font-size:var(--feega-text-sm);font-weight:500}',
    '.fl-input{width:100%;min-height:44px;padding:0 var(--feega-space-4);border:1px solid var(--feega-line);border-radius:var(--feega-radius-md);background:var(--feega-input);color:var(--feega-fg);font:inherit;font-size:var(--feega-text-body);font-weight:400;letter-spacing:var(--feega-tracking);transition:border-color var(--feega-dur-fast) var(--feega-ease),box-shadow var(--feega-dur-fast) var(--feega-ease)}',
    '.fl-input::placeholder{color:var(--feega-fg-subtle)}',
    '.fl-input:hover{border-color:var(--feega-line-strong)}',
    '.fl-input:focus{outline:none;border-color:var(--feega-accent);box-shadow:0 0 0 4px var(--feega-accent-soft)}'
  ],
  badge: [
    '.fl-badge{display:inline-flex;align-items:center;gap:6px;min-height:24px;padding:0 10px;border-radius:var(--feega-radius-full);background:var(--feega-surface);color:var(--feega-fg-muted);font-size:var(--feega-text-xs);font-weight:500;letter-spacing:0;white-space:nowrap}',
    '.fl-badge::before{content:"";width:6px;height:6px;border-radius:var(--feega-radius-full);background:currentColor}',
    '.fl-badge--accent{background:var(--feega-accent-soft);color:var(--feega-accent-text)}',
    '.fl-badge--success{background:var(--feega-success-soft);color:var(--feega-success)}',
    '.fl-badge--danger{background:var(--feega-danger-soft);color:var(--feega-danger)}'
  ],
  avatar: [
    '.fl-avatar{display:inline-grid;flex:none;place-items:center;width:32px;height:32px;border-radius:var(--feega-radius-full);background:var(--feega-surface);color:var(--feega-fg-muted);font-size:var(--feega-text-xs);font-weight:600;letter-spacing:0}'
  ],
  check: [
    '.fl-check{display:inline-flex;align-items:center;gap:var(--feega-space-3);font-size:var(--feega-text-sm);cursor:pointer}',
    '.fl-check input{appearance:none;display:grid;place-items:center;width:18px;height:18px;margin:0;border:1px solid var(--feega-line-strong);border-radius:var(--feega-radius-xs);background:var(--feega-input);cursor:pointer;transition:background-color var(--feega-dur-fast) var(--feega-ease),border-color var(--feega-dur-fast) var(--feega-ease)}',
    '.fl-check input::after{content:"";width:8px;height:8px;background:var(--feega-accent-fg);transform:scale(0);transition:transform var(--feega-dur) var(--feega-ease)}',
    '.fl-check input:checked{border-color:var(--feega-accent);background:var(--feega-accent)}',
    '.fl-check input:checked::after{transform:scale(1)}'
  ],
  switch: [
    '.fl-switch{appearance:none;position:relative;flex:none;width:40px;height:24px;margin:0;border-radius:var(--feega-radius-full);background:var(--feega-line-strong);cursor:pointer;transition:background-color var(--feega-dur) var(--feega-ease)}',
    '.fl-switch::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:var(--feega-radius-full);background:var(--feega-raised);box-shadow:var(--feega-shadow);transition:transform var(--feega-dur) var(--feega-ease)}',
    '.fl-switch:checked{background:var(--feega-accent)}',
    '.fl-switch:checked::after{transform:translateX(16px)}'
  ],
  motion: [
    '@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}'
  ]
};

export function css(c, mods, own) {
  return [...root(c), ...mods.flatMap((m) => MOD[m]), ...own, ...MOD.motion].join('\n') + '\n';
}

export function jsx(markup) {
  return markup
    .replace(/\bclass=/g, 'className=')
    .replace(/\bfor=/g, 'htmlFor=')
    .replace(/\btabindex=/g, 'tabIndex=')
    .replace(/\bautocomplete=/g, 'autoComplete=')
    .replace(/\bmaxlength=/g, 'maxLength=')
    .replace(/\bdatetime=/g, 'dateTime=')
    .replace(/(<input[^>]*?)\schecked\b/g, '$1 defaultChecked')
    .replace(/(<input[^>]*?)\svalue=/g, '$1 defaultValue=')
    .replace(/(<textarea[^>]*?)>([^<]+)<\/textarea>/g, (_, open, text) => `${open} defaultValue="${text}" />`);
}

export function indent(text, n) {
  const pad = ' '.repeat(n);
  return text
    .trim()
    .split('\n')
    .map((line) => (line ? pad + line : line))
    .join('\n');
}
