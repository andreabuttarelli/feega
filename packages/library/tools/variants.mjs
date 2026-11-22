import { px } from './kit.mjs';
import { brand, brandCss, selection, selectionCss } from './sections.mjs';

const LINKS = ['product', 'pricing', 'docs', 'blog'];
const links = (indent) => LINKS.map((l) => `${indent}<li><a href="#">${l}</a></li>`).join('\n');
const linkCss = (c) => [
  `.${c} .links{display:flex;gap:var(--feega-space-1);margin:0;padding:0;list-style:none}`,
  `.${c} .links a{display:inline-flex;align-items:center;min-height:36px;padding:0 14px;border-radius:var(--feega-radius-full);color:var(--feega-fg-muted);font-weight:500;transition:background-color var(--feega-dur-fast) var(--feega-ease),color var(--feega-dur-fast) var(--feega-ease)}`,
  `.${c} .links a:hover{background:var(--feega-surface);color:var(--feega-fg)}`
];
const menu = (items) => `<details class="menu">
        <summary aria-label="Menu">${px('menu')}</summary>
        <ul>
${items.map((l) => `          <li><a href="#">${l}</a></li>`).join('\n')}
        </ul>
      </details>`;
const menuCss = (c) => [
  `.${c} .menu{display:none;position:relative}`,
  `.${c} .menu summary{display:grid;place-items:center;width:40px;height:40px;border-radius:var(--feega-radius-full);list-style:none;cursor:pointer;transition:background-color var(--feega-dur-fast) var(--feega-ease)}`,
  `.${c} .menu summary::-webkit-details-marker{display:none}`,
  `.${c} .menu summary:hover{background:var(--feega-surface)}`,
  `.${c} .menu summary .fl-px{width:14px}`,
  `.${c} .menu ul{position:absolute;top:calc(100% + 8px);right:0;z-index:10;display:grid;min-width:12rem;margin:0;padding:var(--feega-space-2);border-radius:var(--feega-radius-md);background:var(--feega-raised);box-shadow:var(--feega-shadow-float);list-style:none;animation:${c}-in var(--feega-dur) var(--feega-ease)}`,
  `.${c} .menu ul a{display:block;padding:10px 12px;border-radius:var(--feega-radius-sm);font-weight:500}`,
  `.${c} .menu ul a:hover{background:var(--feega-surface)}`,
  `@keyframes ${c}-in{from{opacity:0;transform:translateY(-6px) scale(0.98)}}`
];

export const variants = [
  {
    id: 'navbar-centered',
    name: 'Navbar, centered logo',
    description: 'Links left, logo in the middle, actions right; collapses to a menu on small screens.',
    category: 'section',
    tags: ['navigation', 'header'],
    mods: ['container', 'px', 'btn'],
    markup: `<header class="fl-navbar-centered">
  <div class="fl-container bar">
    <nav aria-label="Primary">
      <ul class="links">
${links('        ')}
      </ul>
    </nav>
    ${brand}
    <div class="actions">
      <a class="login" href="#">log in</a>
      <a class="fl-btn fl-btn--ink fl-btn--sm" href="#">get started</a>
      ${menu([...LINKS, 'log in'])}
    </div>
  </div>
</header>`,
    css: [
      '.fl-navbar-centered{position:relative}',
      '.fl-navbar-centered .bar{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:var(--feega-space-6);min-height:76px}',
      ...brandCss,
      ...linkCss('fl-navbar-centered'),
      '.fl-navbar-centered .links a{padding:0 12px}',
      '.fl-navbar-centered .actions{display:flex;justify-content:flex-end;align-items:center;gap:var(--feega-space-4)}',
      '.fl-navbar-centered .login{font-weight:500;color:var(--feega-fg-muted)}',
      '.fl-navbar-centered .login:hover{color:var(--feega-fg)}',
      ...menuCss('fl-navbar-centered'),
      '@media (max-width:900px){.fl-navbar-centered .bar{grid-template-columns:auto 1fr}.fl-navbar-centered nav,.fl-navbar-centered .login{display:none}.fl-navbar-centered .actions{gap:var(--feega-space-2)}.fl-navbar-centered .menu{display:block}}'
    ]
  },
  {
    id: 'navbar-mega',
    name: 'Navbar, mega menu',
    description: 'A product link that opens a wide panel of grouped links with icons; no JavaScript.',
    category: 'section',
    tags: ['navigation', 'header', 'menu'],
    mods: ['container', 'px', 'btn'],
    markup: `<header class="fl-navbar-mega">
  <div class="fl-container bar">
    ${brand}
    <nav aria-label="Primary">
      <details class="mega">
        <summary>product ${px('chevron')}</summary>
        <div class="panel">
          <ul class="tiles">
            <li><a href="#"><span class="ic">${px('bolt')}</span><b>editor</b><small>Change the page where it runs.</small></a></li>
            <li><a href="#"><span class="ic">${px('layers')}</span><b>components</b><small>Reuse what your team already built.</small></a></li>
            <li><a href="#"><span class="ic">${px('chart')}</span><b>insights</b><small>See what each change moved.</small></a></li>
            <li><a href="#"><span class="ic">${px('plug')}</span><b>integrations</b><small>Connect the tools you use.</small></a></li>
          </ul>
          <a class="feature" href="#">
            <span class="fl-eyebrow">new</span>
            <b>version 2.0 is out</b>
            <small>Read what changed ${px('arrow')}</small>
          </a>
        </div>
      </details>
      <ul class="links">
        <li><a href="#">pricing</a></li>
        <li><a href="#">docs</a></li>
        <li><a href="#">blog</a></li>
      </ul>
    </nav>
    <div class="actions">
      <a class="fl-btn fl-btn--primary fl-btn--sm" href="#">get started</a>
    </div>
  </div>
</header>`,
    css: [
      '.fl-navbar-mega{position:relative;z-index:2}',
      '.fl-navbar-mega .bar{display:flex;align-items:center;gap:var(--feega-space-6);min-height:72px}',
      ...brandCss,
      '.fl-navbar-mega nav{flex:1;display:flex;flex-wrap:wrap;align-items:center;gap:var(--feega-space-1);min-width:0}',
      ...linkCss('fl-navbar-mega'),
      '.fl-navbar-mega summary{display:inline-flex;align-items:center;gap:8px;min-height:36px;padding:0 14px;border-radius:var(--feega-radius-full);color:var(--feega-fg-muted);font-weight:500;list-style:none;cursor:pointer;transition:background-color var(--feega-dur-fast) var(--feega-ease),color var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-navbar-mega summary::-webkit-details-marker{display:none}',
      '.fl-navbar-mega summary:hover,.fl-navbar-mega details[open] summary{background:var(--feega-surface);color:var(--feega-fg)}',
      '.fl-navbar-mega summary .fl-px{width:8px;transition:transform var(--feega-dur) var(--feega-ease)}',
      '.fl-navbar-mega details[open] summary .fl-px{transform:rotate(180deg)}',
      '.fl-navbar-mega .panel{position:absolute;top:calc(100% - 4px);left:50%;z-index:10;display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:var(--feega-space-2);width:min(var(--feega-max-width),100% - 2 * var(--feega-gutter));padding:var(--feega-space-2);border-radius:var(--feega-radius-lg);background:var(--feega-raised);box-shadow:var(--feega-shadow-float);transform:translateX(-50%);animation:fl-navbar-mega-in var(--feega-dur) var(--feega-ease)}',
      '@keyframes fl-navbar-mega-in{from{opacity:0;translate:0 -8px}}',
      '.fl-navbar-mega .tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px;margin:0;padding:0;list-style:none}',
      '.fl-navbar-mega .tiles a{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 14px;padding:14px;border-radius:var(--feega-radius-md);transition:background-color var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-navbar-mega .tiles a:hover{background:var(--feega-surface)}',
      '.fl-navbar-mega .ic{grid-row:span 2;display:grid;place-items:center;width:36px;height:36px;border-radius:var(--feega-radius-sm);background:var(--feega-accent-soft);color:var(--feega-accent-text)}',
      '.fl-navbar-mega .ic .fl-px{width:14px}',
      '.fl-navbar-mega .tiles b,.fl-navbar-mega .feature b{font-weight:500}',
      '.fl-navbar-mega .tiles small{color:var(--feega-fg-muted);font-size:var(--feega-text-sm)}',
      '.fl-navbar-mega .feature{display:flex;flex-direction:column;justify-content:flex-end;gap:6px;min-height:9rem;padding:var(--feega-space-6);border-radius:var(--feega-radius-md);background:var(--feega-surface)}',
      '.fl-navbar-mega .feature b{font-size:var(--feega-text-xl);letter-spacing:-0.04em;line-height:1}',
      '.fl-navbar-mega .feature small{display:inline-flex;align-items:center;gap:8px;color:var(--feega-fg-muted);font-size:var(--feega-text-sm)}',
      '.fl-navbar-mega .feature small .fl-px{width:9px}',
      '@media (max-width:760px){.fl-navbar-mega .bar{flex-wrap:wrap;gap:var(--feega-space-2) var(--feega-space-4);padding-block:var(--feega-space-3)}.fl-navbar-mega nav{order:3;flex-basis:100%;margin-inline:-14px}.fl-navbar-mega .actions{margin-left:auto}.fl-navbar-mega .links a,.fl-navbar-mega summary{padding:0 10px}.fl-navbar-mega .panel,.fl-navbar-mega .tiles{grid-template-columns:minmax(0,1fr)}.fl-navbar-mega .feature{min-height:0}}'
    ]
  },
  {
    id: 'navbar-minimal',
    name: 'Navbar, minimal',
    description: 'Just the logo and one call to action, for focused landing pages.',
    category: 'section',
    tags: ['navigation', 'header'],
    mods: ['container', 'px', 'btn'],
    markup: `<header class="fl-navbar-minimal">
  <div class="fl-container bar">
    ${brand}
    <a class="fl-btn fl-btn--primary fl-btn--sm" href="#">get started ${px('arrow')}</a>
  </div>
</header>`,
    css: [
      '.fl-navbar-minimal .bar{display:flex;align-items:center;justify-content:space-between;gap:var(--feega-space-4);min-height:72px}',
      ...brandCss
    ]
  },
  {
    id: 'navbar-app',
    name: 'Navbar, app with search',
    description: 'Product header with workspace, search field, notifications and avatar.',
    category: 'app',
    tags: ['navigation', 'header', 'search'],
    mods: ['px', 'avatar'],
    markup: `<header class="fl-navbar-app">
  <a class="logo" href="#" aria-label="Yourbrand home">${px('mark')}</a>
  <button class="ws" type="button"><span class="dot" aria-hidden="true"></span>Workspace ${px('chevron')}</button>
  <label class="search">${px('search')}<input type="search" placeholder="Search projects, people, pages" aria-label="Search" /><kbd>⌘K</kbd></label>
  <div class="end">
    <button class="icon" type="button" aria-label="Notifications">${px('bell')}<span class="ping" aria-hidden="true"></span></button>
    <button class="icon" type="button" aria-label="Help">${px('chat')}</button>
    <span class="fl-avatar" aria-label="Name Surname">NS</span>
  </div>
</header>`,
    css: [
      '.fl-navbar-app{display:flex;align-items:center;gap:var(--feega-space-3);min-height:60px;padding:0 var(--feega-gutter);border-bottom:1px solid var(--feega-line)}',
      '.fl-navbar-app .logo{display:grid;place-items:center;width:32px;height:32px;border-radius:var(--feega-radius-sm);background:var(--feega-fg);color:var(--feega-accent)}',
      '.fl-navbar-app .logo .fl-px{width:14px}',
      '.fl-navbar-app .ws{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 10px;border:0;border-radius:var(--feega-radius-sm);background:transparent;color:var(--feega-fg);font:inherit;font-size:var(--feega-text-sm);font-weight:500;letter-spacing:var(--feega-tracking);cursor:pointer;white-space:nowrap}',
      '.fl-navbar-app .ws:hover,.fl-navbar-app .icon:hover{background:var(--feega-surface)}',
      '.fl-navbar-app .ws .fl-px{width:8px;color:var(--feega-fg-subtle)}',
      '.fl-navbar-app .dot{width:8px;height:8px;border-radius:var(--feega-radius-xs);background:var(--feega-accent)}',
      '.fl-navbar-app .search{flex:1;display:flex;align-items:center;gap:8px;max-width:28rem;min-width:0;height:36px;margin-inline:auto;padding:0 12px;border-radius:var(--feega-radius-full);background:var(--feega-surface);color:var(--feega-fg-subtle);transition:box-shadow var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-navbar-app .search:focus-within{box-shadow:0 0 0 1px var(--feega-accent),0 0 0 4px var(--feega-accent-soft)}',
      '.fl-navbar-app .search .fl-px{width:12px}',
      '.fl-navbar-app .search input{flex:1;min-width:0;border:0;background:transparent;color:var(--feega-fg);font:inherit;font-size:var(--feega-text-sm);outline:none}',
      '.fl-navbar-app .search input::placeholder{color:var(--feega-fg-subtle)}',
      '.fl-navbar-app kbd{font-family:var(--feega-font-mono);font-size:11px}',
      '.fl-navbar-app .end{display:flex;align-items:center;gap:var(--feega-space-1)}',
      '.fl-navbar-app .icon{position:relative;display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:var(--feega-radius-full);background:transparent;color:var(--feega-fg-muted);cursor:pointer}',
      '.fl-navbar-app .icon .fl-px{width:14px}',
      '.fl-navbar-app .ping{position:absolute;top:8px;right:8px;width:7px;height:7px;border-radius:var(--feega-radius-full);background:var(--feega-accent);box-shadow:0 0 0 2px var(--feega-bg)}',
      '.fl-navbar-app .fl-avatar{margin-left:var(--feega-space-1)}',
      '@media (max-width:640px){.fl-navbar-app .ws,.fl-navbar-app .icon + .icon,.fl-navbar-app kbd{display:none}}'
    ]
  },
  {
    id: 'hero-product',
    name: 'Hero, product screenshot',
    description: 'Centered headline over a browser-framed product mockup; swap the mockup for a real screenshot.',
    category: 'section',
    tags: ['hero', 'landing', 'image'],
    mods: ['container', 'px', 'btn', 'type', 'dots'],
    markup: `<section class="fl-hero-product">
  <div class="fl-container head">
    <p class="fl-eyebrow">for product teams</p>
    <h1 class="title">show the product, not a promise</h1>
    <p class="fl-lead">One sentence on what the screenshot below lets people do. Replace the mockup with a real capture.</p>
    <div class="cta">
      <a class="fl-btn fl-btn--primary" href="#">start free</a>
      <a class="fl-btn" href="#">take the tour ${px('arrow')}</a>
    </div>
  </div>
  <div class="fl-container">
    <figure class="shot fl-dots" aria-label="Product screenshot placeholder">
      <div class="window">
        <div class="chrome"><i></i><i></i><i></i><span>app.example.com</span></div>
        <div class="app">
          <div class="side"><b></b><b></b><b></b><b></b><b></b></div>
          <div class="body">
            <div class="row"><span class="h"></span><span class="pill"></span></div>
            <div class="cards"><span></span><span></span><span></span></div>
            <div class="chart"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
          </div>
        </div>
      </div>
      <figcaption>screenshot placeholder</figcaption>
    </figure>
  </div>
</section>`,
    css: [
      '.fl-hero-product{overflow:hidden;padding-top:var(--feega-space-section)}',
      '.fl-hero-product .head{display:flex;flex-direction:column;align-items:center;gap:var(--feega-space-6);text-align:center}',
      '.fl-hero-product .title{max-width:15ch;font-family:var(--feega-font-display);font-size:var(--feega-text-display);font-weight:500;line-height:0.92;letter-spacing:var(--feega-tracking-tight);text-wrap:balance}',
      '.fl-hero-product .cta{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--feega-space-3)}',
      '.fl-hero-product .shot{position:relative;margin-top:var(--feega-space-16);padding:clamp(1rem,4vw,3rem) clamp(1rem,4vw,3rem) 0;border-radius:var(--feega-radius-lg) var(--feega-radius-lg) 0 0;background-color:var(--feega-surface)}',
      '.fl-hero-product .window{overflow:hidden;border-radius:var(--feega-radius-md) var(--feega-radius-md) 0 0;background:var(--feega-raised);box-shadow:var(--feega-shadow-float);animation:fl-hero-product-up 900ms var(--feega-ease) backwards}',
      '@keyframes fl-hero-product-up{from{opacity:0;transform:translateY(40px)}}',
      '.fl-hero-product .chrome{display:flex;align-items:center;gap:6px;height:36px;padding:0 14px;border-bottom:1px solid var(--feega-line)}',
      '.fl-hero-product .chrome i{width:9px;height:9px;border-radius:var(--feega-radius-full);background:var(--feega-line-strong)}',
      '.fl-hero-product .chrome span{margin-inline:auto;padding-right:40px;font-family:var(--feega-font-mono);font-size:11px;color:var(--feega-fg-subtle)}',
      '.fl-hero-product .app{display:grid;grid-template-columns:minmax(0,180px) minmax(0,1fr);min-height:clamp(220px,34vw,420px)}',
      '.fl-hero-product .side{display:grid;align-content:start;gap:10px;padding:18px;border-right:1px solid var(--feega-line)}',
      '.fl-hero-product .side b{height:10px;border-radius:var(--feega-radius-xs);background:var(--feega-surface)}',
      '.fl-hero-product .side b:first-child{width:60%;background:var(--feega-accent)}',
      '.fl-hero-product .body{display:grid;align-content:start;gap:18px;padding:clamp(14px,3vw,28px)}',
      '.fl-hero-product .row{display:flex;justify-content:space-between;align-items:center}',
      '.fl-hero-product .h{width:40%;height:18px;border-radius:var(--feega-radius-xs);background:var(--feega-fg)}',
      '.fl-hero-product .pill{width:72px;height:22px;border-radius:var(--feega-radius-full);background:var(--feega-accent)}',
      '.fl-hero-product .cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}',
      '.fl-hero-product .cards span{height:clamp(40px,7vw,72px);border-radius:var(--feega-radius-sm);background:var(--feega-surface)}',
      '.fl-hero-product .chart{display:flex;align-items:flex-end;gap:6px;height:clamp(60px,10vw,140px)}',
      '.fl-hero-product .chart i{flex:1;height:var(--h,50%);border-radius:var(--feega-radius-xs) var(--feega-radius-xs) 0 0;background:var(--feega-line-strong)}',
      ...[34, 48, 40, 56, 52, 64, 60, 74, 82, 100].map((h, i) => `.fl-hero-product .chart i:nth-child(${i + 1}){--h:${h}%}`),
      '.fl-hero-product .chart i:last-child{background:var(--feega-accent)}',
      '.fl-hero-product figcaption{position:absolute;top:12px;right:14px;font-family:var(--feega-font-mono);font-size:10px;color:var(--feega-fg-subtle);text-transform:uppercase}',
      '@media (max-width:640px){.fl-hero-product .app{grid-template-columns:minmax(0,1fr)}.fl-hero-product .side,.fl-hero-product figcaption{display:none}}'
    ]
  },
  {
    id: 'hero-code',
    name: 'Hero, code snippet',
    description: 'Headline beside a terminal card with a copyable install command; for developer products.',
    category: 'section',
    tags: ['hero', 'landing', 'developer'],
    mods: ['container', 'px', 'btn', 'type'],
    markup: `<section class="fl-hero-code">
  <div class="fl-container grid">
    <div class="copy">
      <p class="fl-eyebrow">for developers</p>
      <h1 class="fl-title">one command, then it just works</h1>
      <p class="fl-lead">Say what runs after install and what the developer no longer has to do by hand.</p>
      <div class="cta">
        <a class="fl-btn fl-btn--primary" href="#">read the docs</a>
        <a class="fl-btn fl-btn--ghost" href="#">view on GitHub ${px('arrow')}</a>
      </div>
    </div>
    <figure class="term" aria-label="Terminal example">
      <div class="bar"><i></i><i></i><i></i><span>terminal</span></div>
      <pre><code><span class="p">$</span> npx yourbrand init<br /><span class="m">✓ found a Vite project</span><br /><span class="m">✓ added the plugin to vite.config.ts</span><br /><span class="m">✓ wrote yourbrand.json</span><br /><br /><span class="p">$</span> npm run dev<br /><span class="a">ready</span> <span class="m">in 312 ms on</span> localhost:5173<span class="caret"></span></code></pre>
    </figure>
  </div>
</section>`,
    css: [
      '.fl-hero-code{padding-block:var(--feega-space-section)}',
      '.fl-hero-code .grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center;gap:var(--feega-space-16)}',
      '.fl-hero-code .copy{display:flex;flex-direction:column;align-items:flex-start;gap:var(--feega-space-6)}',
      '.fl-hero-code .cta{display:flex;flex-wrap:wrap;gap:var(--feega-space-3)}',
      '.fl-hero-code .term{min-width:0;overflow:hidden;border-radius:var(--feega-radius-lg);background:var(--feega-fg);color:var(--feega-bg);box-shadow:var(--feega-shadow-float)}',
      '.fl-hero-code .bar{display:flex;align-items:center;gap:6px;height:40px;padding:0 16px}',
      '.fl-hero-code .bar i{width:9px;height:9px;border-radius:var(--feega-radius-full);background:var(--feega-fg-muted)}',
      '.fl-hero-code .bar span{margin-left:auto;font-family:var(--feega-font-mono);font-size:11px;color:var(--feega-fg-subtle)}',
      '.fl-hero-code pre{margin:0;padding:var(--feega-space-6);overflow-x:auto;font-family:var(--feega-font-mono);font-size:clamp(0.75rem,1.3vw,0.875rem);line-height:1.8;letter-spacing:0}',
      '.fl-hero-code .p{color:var(--feega-accent)}',
      '.fl-hero-code .m{color:var(--feega-fg-subtle)}',
      '.fl-hero-code .a{color:var(--feega-success)}',
      '.fl-hero-code .caret{display:inline-block;width:8px;height:1.1em;margin-left:4px;vertical-align:text-bottom;background:var(--feega-accent);animation:fl-hero-code-blink 1s steps(1) infinite}',
      '@keyframes fl-hero-code-blink{50%{opacity:0}}',
      '@media (max-width:900px){.fl-hero-code .grid{grid-template-columns:minmax(0,1fr);gap:var(--feega-space-12)}}'
    ]
  },
  {
    id: 'hero-media',
    name: 'Hero, video frame',
    description: 'Headline over a wide media frame with a play button; drop a video or poster image in.',
    category: 'section',
    tags: ['hero', 'landing', 'video'],
    mods: ['container', 'px', 'btn', 'dots'],
    markup: `<section class="fl-hero-media">
  <div class="fl-container top">
    <h1 class="title">see it in ninety seconds</h1>
    <div class="side">
      <p>Two lines on what the video shows. Keep it under a minute and a half, captions on.</p>
      <a class="fl-btn fl-btn--primary" href="#">get started</a>
    </div>
  </div>
  <div class="fl-container">
    <div class="media fl-dots">
      <span class="label">video placeholder, 16:9</span>
      <button class="play" type="button" aria-label="Play video">${px('play')}</button>
      <span class="time">01:30</span>
    </div>
  </div>
</section>`,
    css: [
      '.fl-hero-media{padding-block:var(--feega-space-section)}',
      '.fl-hero-media .top{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);align-items:end;gap:var(--feega-space-8);margin-bottom:var(--feega-space-12)}',
      '.fl-hero-media .title{font-family:var(--feega-font-display);font-size:var(--feega-text-display);font-weight:500;line-height:0.92;letter-spacing:var(--feega-tracking-tight);text-wrap:balance}',
      '.fl-hero-media .side{display:grid;justify-items:start;gap:var(--feega-space-6);color:var(--feega-fg-muted);font-size:var(--feega-text-lg);line-height:1.4}',
      '.fl-hero-media .media{position:relative;display:grid;place-items:center;aspect-ratio:16/9;overflow:hidden;border-radius:var(--feega-radius-lg);background-color:var(--feega-surface)}',
      '.fl-hero-media .label{position:absolute;top:16px;left:18px;font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);color:var(--feega-fg-subtle);text-transform:uppercase}',
      '.fl-hero-media .time{position:absolute;right:18px;bottom:16px;padding:2px 8px;border-radius:var(--feega-radius-xs);background:var(--feega-raised);font-family:var(--feega-font-mono);font-size:var(--feega-text-xs)}',
      '.fl-hero-media .play{display:grid;place-items:center;width:clamp(64px,10vw,104px);aspect-ratio:1;border:0;border-radius:var(--feega-radius-full);background:var(--feega-accent);color:var(--feega-accent-fg);box-shadow:var(--feega-shadow-float);cursor:pointer;transition:transform var(--feega-dur) var(--feega-ease)}',
      '.fl-hero-media .play:hover{transform:scale(1.06)}',
      '.fl-hero-media .play .fl-px{width:28%;margin-left:6%}',
      '@media (max-width:820px){.fl-hero-media .top{grid-template-columns:minmax(0,1fr)}}'
    ]
  },
  {
    id: 'hero-bento',
    name: 'Hero, bento',
    description: 'Headline tile plus a grid of proof tiles: a metric, a quote, a feature and a call to action.',
    category: 'section',
    tags: ['hero', 'landing', 'bento'],
    mods: ['container', 'px', 'btn', 'dots'],
    markup: `<section class="fl-hero-bento">
  <div class="fl-container grid">
    <div class="tile main">
      <p class="tag">yourbrand / 2026</p>
      <h1>build the page your team keeps asking for</h1>
      <div class="cta"><a class="fl-btn fl-btn--primary" href="#">start free</a><a class="fl-btn" href="#">see examples</a></div>
    </div>
    <div class="tile metric"><b>4.2×</b><span>faster to ship, placeholder figure</span></div>
    <div class="tile art fl-dots" aria-hidden="true">${selection.replace('h1.title', 'div.card')}<span class="box"></span></div>
    <div class="tile note"><p>“Replace with a short customer line.”</p><span>Name Surname, Company</span></div>
    <a class="tile go" href="#"><span>read the launch post</span>${px('arrow')}</a>
  </div>
</section>`,
    css: [
      '.fl-hero-bento{padding-block:var(--feega-space-12)}',
      '.fl-hero-bento .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:minmax(10rem,auto);gap:var(--feega-space-3)}',
      '.fl-hero-bento .tile{position:relative;display:flex;flex-direction:column;justify-content:space-between;gap:var(--feega-space-4);padding:var(--feega-space-6);border-radius:var(--feega-radius-lg);background:var(--feega-surface)}',
      '.fl-hero-bento .main{grid-column:span 3;grid-row:span 2;padding:clamp(1.5rem,4vw,3rem);background:var(--feega-fg);color:var(--feega-bg)}',
      '.fl-hero-bento .tag{font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);color:var(--feega-fg-subtle);text-transform:uppercase}',
      '.fl-hero-bento h1{max-width:13ch;font-family:var(--feega-font-display);font-size:clamp(2.75rem,7vw,6rem);font-weight:500;line-height:0.92;letter-spacing:var(--feega-tracking-tight);text-wrap:balance}',
      '.fl-hero-bento .cta{display:flex;flex-wrap:wrap;gap:var(--feega-space-3)}',
      '.fl-hero-bento .main .fl-btn:not(.fl-btn--primary){border-color:var(--feega-fg-muted);color:var(--feega-bg)}',
      '.fl-hero-bento .main .fl-btn:not(.fl-btn--primary):hover{background:transparent;border-color:var(--feega-bg)}',
      '.fl-hero-bento .metric{background:var(--feega-accent);color:var(--feega-accent-fg)}',
      '.fl-hero-bento .metric b{font-size:clamp(3rem,6vw,4.5rem);font-weight:500;line-height:1;letter-spacing:var(--feega-tracking-tight)}',
      '.fl-hero-bento .metric span{font-size:var(--feega-text-sm);font-weight:500}',
      '.fl-hero-bento .art{display:grid;place-items:center;background-color:var(--feega-surface)}',
      '.fl-hero-bento .art .box{position:absolute;inset:28% 20%;border-radius:var(--feega-radius-sm);background:var(--feega-raised);box-shadow:var(--feega-shadow)}',
      ...selectionCss.map((r) => r.replace('.sel{', '.fl-hero-bento .sel{inset:28% 20%;z-index:1;').replace(/^\.sel /, '.fl-hero-bento .sel ')),
      '.fl-hero-bento .note p{font-size:var(--feega-text-xl);font-weight:500;line-height:1.1;letter-spacing:-0.04em}',
      '.fl-hero-bento .note span{color:var(--feega-fg-muted);font-size:var(--feega-text-sm)}',
      '.fl-hero-bento .note{grid-column:span 2}',
      '.fl-hero-bento .go{grid-column:span 2;flex-direction:row;align-items:flex-end;font-size:var(--feega-text-xl);font-weight:500;letter-spacing:-0.04em;transition:background-color var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-hero-bento .go:hover{background:var(--feega-line)}',
      '.fl-hero-bento .go .fl-px{width:18px;transition:transform var(--feega-dur) var(--feega-ease)}',
      '.fl-hero-bento .go:hover .fl-px{transform:translateX(6px)}',
      '@media (max-width:900px){.fl-hero-bento .grid{grid-template-columns:repeat(2,minmax(0,1fr))}.fl-hero-bento .main{grid-column:1/-1;grid-row:auto;min-height:24rem}.fl-hero-bento .note,.fl-hero-bento .go{grid-column:1/-1}}',
      '@media (max-width:480px){.fl-hero-bento .grid{grid-template-columns:minmax(0,1fr)}.fl-hero-bento .art{min-height:10rem}}'
    ]
  },
  {
    id: 'hero-minimal',
    name: 'Hero, text only',
    description: 'One huge lowercase line and a single link; nothing else on the page competes.',
    category: 'section',
    tags: ['hero', 'landing', 'minimal'],
    mods: ['container', 'px'],
    markup: `<section class="fl-hero-minimal">
  <div class="fl-container inner">
    <h1>say the one thing <em>you do best</em></h1>
    <div class="foot">
      <p>One short line under the headline, if it earns its place.</p>
      <a href="#">get started ${px('arrow')}</a>
    </div>
  </div>
</section>`,
    css: [
      '.fl-hero-minimal{padding-block:var(--feega-space-section)}',
      '.fl-hero-minimal .inner{display:grid;gap:var(--feega-space-12)}',
      '.fl-hero-minimal h1{font-family:var(--feega-font-display);font-size:clamp(3.25rem,12vw,10rem);font-weight:500;line-height:0.88;letter-spacing:-0.06em;text-wrap:balance}',
      '.fl-hero-minimal em{font-style:normal;color:var(--feega-fg-subtle)}',
      '.fl-hero-minimal .foot{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:var(--feega-space-4);padding-top:var(--feega-space-6);border-top:1px solid var(--feega-line);color:var(--feega-fg-muted)}',
      '.fl-hero-minimal .foot a{display:inline-flex;align-items:center;gap:10px;color:var(--feega-fg);font-size:var(--feega-text-lg);font-weight:500;border-bottom:1px solid var(--feega-accent)}',
      '.fl-hero-minimal .foot .fl-px{width:11px;color:var(--feega-accent);transition:transform var(--feega-dur) var(--feega-ease)}',
      '.fl-hero-minimal .foot a:hover .fl-px{transform:translateX(4px)}'
    ]
  },
  {
    id: 'footer-wordmark',
    name: 'Footer, big wordmark',
    description: 'Links on top, the brand name set edge to edge at the bottom.',
    category: 'section',
    tags: ['footer', 'navigation'],
    mods: ['container'],
    markup: `<footer class="fl-footer-wordmark">
  <div class="fl-container top">
    <ul>
      <li><a href="#">product</a></li>
      <li><a href="#">pricing</a></li>
      <li><a href="#">docs</a></li>
      <li><a href="#">blog</a></li>
    </ul>
    <ul>
      <li><a href="#">GitHub</a></li>
      <li><a href="#">X</a></li>
      <li><a href="#">LinkedIn</a></li>
    </ul>
    <p>hi@example.com</p>
  </div>
  <p class="mark" aria-hidden="true">yourbrand</p>
  <div class="fl-container legal"><span>© 2026 Yourbrand</span><span><a href="#">privacy</a> · <a href="#">terms</a></span></div>
</footer>`,
    css: [
      '.fl-footer-wordmark{container-type:inline-size;overflow:hidden;padding-top:var(--feega-space-16);background:var(--feega-fg);color:var(--feega-bg)}',
      '.fl-footer-wordmark .top{display:grid;align-items:start;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--feega-space-8);font-weight:500}',
      '.fl-footer-wordmark ul{display:grid;gap:var(--feega-space-2);margin:0;padding:0;list-style:none}',
      '.fl-footer-wordmark a{transition:color var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-footer-wordmark a:hover{color:var(--feega-accent)}',
      '.fl-footer-wordmark .top p{justify-self:end}',
      '.fl-footer-wordmark .mark{margin-top:var(--feega-space-12);font-size:21.5cqi;font-weight:600;line-height:1;letter-spacing:-0.075em;text-align:center;white-space:nowrap}',
      '.fl-footer-wordmark .legal{display:flex;flex-wrap:wrap;justify-content:space-between;gap:var(--feega-space-2);padding-block:var(--feega-space-6);color:var(--feega-fg-subtle);font-size:var(--feega-text-sm)}',
      '@media (max-width:640px){.fl-footer-wordmark .top{grid-template-columns:repeat(2,minmax(0,1fr))}.fl-footer-wordmark .top p{grid-column:1/-1;justify-self:start}}'
    ]
  },
  {
    id: 'footer-newsletter',
    name: 'Footer, columns and newsletter',
    description: 'Link columns next to an email signup, with a legal row underneath.',
    category: 'section',
    tags: ['footer', 'newsletter', 'form'],
    mods: ['container', 'px', 'btn', 'field'],
    markup: `<footer class="fl-footer-newsletter">
  <div class="fl-container grid">
    <form class="news" action="#">
      ${brand}
      <label class="fl-field" for="fl-footer-email">get the monthly update
        <span class="row"><input class="fl-input" id="fl-footer-email" type="email" placeholder="you@example.com" autocomplete="email" required /><button class="fl-btn fl-btn--primary" type="submit">subscribe</button></span>
      </label>
      <small>One email a month. Unsubscribe in one click.</small>
    </form>
    <nav class="cols" aria-label="Footer">
      <div><p>product</p><ul><li><a href="#">features</a></li><li><a href="#">pricing</a></li><li><a href="#">changelog</a></li></ul></div>
      <div><p>company</p><ul><li><a href="#">about</a></li><li><a href="#">careers</a></li><li><a href="#">contact</a></li></ul></div>
      <div><p>resources</p><ul><li><a href="#">docs</a></li><li><a href="#">guides</a></li><li><a href="#">status</a></li></ul></div>
    </nav>
  </div>
  <div class="fl-container legal"><span>© 2026 Yourbrand</span><span><a href="#">privacy</a><a href="#">terms</a><a href="#">cookies</a></span></div>
</footer>`,
    css: [
      '.fl-footer-newsletter{padding-top:var(--feega-space-16);border-top:1px solid var(--feega-line)}',
      '.fl-footer-newsletter .grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:var(--feega-space-16)}',
      ...brandCss,
      '.fl-footer-newsletter .news{display:grid;align-content:start;justify-items:start;gap:var(--feega-space-6);max-width:26rem}',
      '.fl-footer-newsletter .fl-field{width:100%}',
      '.fl-footer-newsletter .row{display:flex;gap:var(--feega-space-2)}',
      '.fl-footer-newsletter .row .fl-input{flex:1;min-width:0;border-radius:var(--feega-radius-full)}',
      '.fl-footer-newsletter small{color:var(--feega-fg-subtle);font-size:var(--feega-text-xs)}',
      '.fl-footer-newsletter .cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--feega-space-6)}',
      '.fl-footer-newsletter .cols p{margin-bottom:var(--feega-space-3);font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);color:var(--feega-fg-subtle);text-transform:uppercase}',
      '.fl-footer-newsletter ul{display:grid;gap:var(--feega-space-2);margin:0;padding:0;list-style:none;font-weight:500}',
      '.fl-footer-newsletter a:hover{color:var(--feega-accent-text)}',
      '.fl-footer-newsletter .legal{display:flex;flex-wrap:wrap;justify-content:space-between;gap:var(--feega-space-3);margin-top:var(--feega-space-16);padding-block:var(--feega-space-6);border-top:1px solid var(--feega-line);color:var(--feega-fg-subtle);font-size:var(--feega-text-sm)}',
      '.fl-footer-newsletter .legal span:last-child{display:flex;gap:var(--feega-space-4)}',
      '@media (max-width:820px){.fl-footer-newsletter .grid{grid-template-columns:minmax(0,1fr);gap:var(--feega-space-12)}}',
      '@media (max-width:420px){.fl-footer-newsletter .row{flex-direction:column}.fl-footer-newsletter .cols{grid-template-columns:repeat(2,minmax(0,1fr))}}'
    ]
  },
  {
    id: 'footer-minimal',
    name: 'Footer, one line',
    description: 'Copyright, a few links and a status dot on a single row that wraps on phones.',
    category: 'section',
    tags: ['footer'],
    mods: ['container', 'px'],
    markup: `<footer class="fl-footer-minimal">
  <div class="fl-container row">
    <span class="brand">${px('mark')}© 2026 Yourbrand</span>
    <nav aria-label="Footer"><a href="#">privacy</a><a href="#">terms</a><a href="#">docs</a><a href="#">contact</a></nav>
    <span class="status"><i></i>all systems normal</span>
  </div>
</footer>`,
    css: [
      '.fl-footer-minimal{border-top:1px solid var(--feega-line)}',
      '.fl-footer-minimal .row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--feega-space-3) var(--feega-space-8);min-height:64px;padding-block:var(--feega-space-4);font-size:var(--feega-text-sm);color:var(--feega-fg-muted)}',
      '.fl-footer-minimal .brand{display:inline-flex;align-items:center;gap:8px}',
      '.fl-footer-minimal .brand .fl-px{width:11px;color:var(--feega-accent)}',
      '.fl-footer-minimal nav{display:flex;flex-wrap:wrap;gap:var(--feega-space-4)}',
      '.fl-footer-minimal nav a:hover{color:var(--feega-fg)}',
      '.fl-footer-minimal .status{display:inline-flex;align-items:center;gap:8px;margin-left:auto;font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);text-transform:uppercase}',
      '.fl-footer-minimal .status i{width:7px;height:7px;border-radius:var(--feega-radius-full);background:var(--feega-success)}',
      '@media (max-width:560px){.fl-footer-minimal .status{margin-left:0}}'
    ]
  }
];
