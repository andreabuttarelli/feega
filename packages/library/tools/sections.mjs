import { px } from './kit.mjs';

export const brand = `<a class="brand" href="#" aria-label="Yourbrand home">${px('mark')}<span>yourbrand</span></a>`;
export const brandCss = [
  '.brand{display:inline-flex;align-items:center;gap:10px;font-size:1.125rem;font-weight:600;letter-spacing:-0.04em}',
  '.brand .fl-px{width:16px;color:var(--feega-accent)}'
];

export const selection = `<div class="sel" aria-hidden="true"><span class="tag">h1.title</span><i></i><i></i><i></i><i></i></div>`;
export const selectionCss = [
  '.sel{position:absolute;border:1px solid var(--feega-accent);pointer-events:none}',
  '.sel .tag{position:absolute;bottom:100%;left:-1px;margin-bottom:4px;padding:2px 6px;border-radius:var(--feega-radius-xs);background:var(--feega-accent);color:var(--feega-accent-fg);font-family:var(--feega-font-mono);font-size:10px;letter-spacing:0;white-space:nowrap}',
  '.sel i{position:absolute;width:7px;height:7px;border:1px solid var(--feega-accent);background:var(--feega-raised)}',
  '.sel i:nth-of-type(1){top:-4px;left:-4px}',
  '.sel i:nth-of-type(2){top:-4px;right:-4px}',
  '.sel i:nth-of-type(3){bottom:-4px;left:-4px}',
  '.sel i:nth-of-type(4){right:-4px;bottom:-4px}'
];

export const sections = [
  {
    id: 'navbar',
    mods: ['container', 'px', 'btn'],
    markup: `<header class="fl-navbar">
  <div class="fl-container bar">
    ${brand}
    <nav aria-label="Primary">
      <ul class="links">
        <li><a href="#" aria-current="page">product</a></li>
        <li><a href="#">pricing</a></li>
        <li><a href="#">docs</a></li>
        <li><a href="#">blog</a></li>
        <li><a href="#">changelog</a></li>
      </ul>
    </nav>
    <div class="actions">
      <a class="login" href="#">log in</a>
      <a class="fl-btn fl-btn--primary fl-btn--sm" href="#">get started</a>
      <details class="menu">
        <summary aria-label="Menu">${px('menu')}</summary>
        <ul>
          <li><a href="#">product</a></li>
          <li><a href="#">pricing</a></li>
          <li><a href="#">docs</a></li>
          <li><a href="#">blog</a></li>
          <li><a href="#">log in</a></li>
        </ul>
      </details>
    </div>
  </div>
</header>`,
    css: [
      '.fl-navbar{position:relative}',
      '.fl-navbar .bar{display:flex;align-items:center;gap:var(--feega-space-6);min-height:72px}',
      ...brandCss,
      '.fl-navbar nav{flex:1;display:flex;justify-content:center}',
      '.fl-navbar .links{display:flex;gap:var(--feega-space-1);padding:0;list-style:none}',
      '.fl-navbar .links a{display:inline-flex;align-items:center;min-height:36px;padding:0 14px;border-radius:var(--feega-radius-full);color:var(--feega-fg-muted);font-weight:500;transition:background-color var(--feega-dur-fast) var(--feega-ease),color var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-navbar .links a:hover{background:var(--feega-surface);color:var(--feega-fg)}',
      '.fl-navbar .links a[aria-current="page"]{color:var(--feega-fg)}',
      '.fl-navbar .actions{display:flex;align-items:center;gap:var(--feega-space-4)}',
      '.fl-navbar .login{font-weight:500;color:var(--feega-fg-muted);transition:color var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-navbar .login:hover{color:var(--feega-fg)}',
      '.fl-navbar .menu{display:none;position:relative}',
      '.fl-navbar .menu summary{display:grid;place-items:center;width:40px;height:40px;border-radius:var(--feega-radius-full);list-style:none;cursor:pointer;transition:background-color var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-navbar .menu summary::-webkit-details-marker{display:none}',
      '.fl-navbar .menu summary:hover{background:var(--feega-surface)}',
      '.fl-navbar .menu summary .fl-px{width:14px}',
      '.fl-navbar .menu ul{position:absolute;top:calc(100% + 8px);right:0;z-index:10;display:grid;min-width:12rem;padding:var(--feega-space-2);border-radius:var(--feega-radius-md);background:var(--feega-raised);box-shadow:var(--feega-shadow-float);list-style:none;animation:fl-navbar-in var(--feega-dur) var(--feega-ease)}',
      '.fl-navbar .menu ul a{display:block;padding:10px 12px;border-radius:var(--feega-radius-sm);font-weight:500}',
      '.fl-navbar .menu ul a:hover{background:var(--feega-surface)}',
      '@keyframes fl-navbar-in{from{opacity:0;transform:translateY(-6px) scale(0.98)}}',
      '@media (max-width:820px){.fl-navbar nav,.fl-navbar .login{display:none}.fl-navbar .actions{margin-left:auto;gap:var(--feega-space-2)}.fl-navbar .menu{display:block}}'
    ]
  },
  {
    id: 'hero-centered',
    mods: ['container', 'px', 'btn', 'dots'],
    markup: `<section class="fl-hero-centered">
  <div class="field fl-dots" aria-hidden="true"></div>
  <div class="fl-container inner">
    <a class="pill" href="#"><span class="new">new</span>version 2.0 is out ${px('arrow')}</a>
    <h1 class="title">the headline that says what you do</h1>
    <p class="lead">One or two sentences on who it is for and what changes for them. Plain words, no buzzwords, under thirty.</p>
    <div class="cta">
      <a class="fl-btn fl-btn--primary" href="#">get started free</a>
      <a class="fl-btn" href="#">book a demo ${px('arrow')}</a>
    </div>
    <ul class="points">
      <li>free to start</li>
      <li>no card needed</li>
      <li>cancel anytime</li>
    </ul>
  </div>
</section>`,
    css: [
      '.fl-hero-centered{position:relative;overflow:hidden;padding-block:var(--feega-space-section)}',
      '.fl-hero-centered .field{position:absolute;inset:0;-webkit-mask-image:radial-gradient(ellipse 60% 70% at 50% 40%,var(--feega-fg),transparent);mask-image:radial-gradient(ellipse 60% 70% at 50% 40%,var(--feega-fg),transparent)}',
      '.fl-hero-centered .inner{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center}',
      '.fl-hero-centered .pill{display:inline-flex;align-items:center;gap:10px;min-height:34px;padding:0 14px 0 4px;border:1px solid var(--feega-line);border-radius:var(--feega-radius-full);background:var(--feega-raised);color:var(--feega-fg-muted);font-size:var(--feega-text-sm);font-weight:500;transition:border-color var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-hero-centered .pill:hover{border-color:var(--feega-line-strong);color:var(--feega-fg)}',
      '.fl-hero-centered .pill .fl-px{width:9px}',
      '.fl-hero-centered .new{display:inline-flex;align-items:center;min-height:26px;padding:0 10px;border-radius:var(--feega-radius-full);background:var(--feega-accent);color:var(--feega-accent-fg);font-size:var(--feega-text-xs)}',
      '.fl-hero-centered .title{max-width:14ch;margin-top:var(--feega-space-8);font-family:var(--feega-font-display);font-size:var(--feega-text-display);font-weight:500;line-height:0.92;letter-spacing:var(--feega-tracking-tight);text-wrap:balance}',
      '.fl-hero-centered .lead{max-width:32rem;margin-top:var(--feega-space-6);font-size:var(--feega-text-lg);line-height:1.4;color:var(--feega-fg-muted);text-wrap:pretty}',
      '.fl-hero-centered .cta{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--feega-space-3);margin-top:var(--feega-space-8)}',
      '.fl-hero-centered .points{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--feega-space-2) var(--feega-space-6);margin-top:var(--feega-space-8);padding:0;list-style:none;font-size:var(--feega-text-sm);font-weight:500}',
      '.fl-hero-centered .points li{display:inline-flex;align-items:center;gap:10px}',
      '.fl-hero-centered .points li::before{content:"";width:6px;height:6px;background:var(--feega-accent)}'
    ]
  },
  {
    id: 'hero-split',
    mods: ['container', 'px', 'btn', 'type', 'dots'],
    markup: `<section class="fl-hero-split">
  <div class="fl-container grid">
    <div class="copy">
      <p class="fl-eyebrow">for product teams</p>
      <h1 class="fl-title">from idea to shipped, in one place</h1>
      <p class="fl-lead">Say what the product does and why it matters, in one or two sentences a busy person reads in full.</p>
      <div class="cta">
        <a class="fl-btn fl-btn--primary" href="#">start building</a>
        <a class="fl-btn fl-btn--ghost" href="#">see how it works ${px('arrow')}</a>
      </div>
      <dl class="stats">
        <div><dt>setup</dt><dd>2 min</dd></div>
        <div><dt>uptime</dt><dd>99.9%</dd></div>
        <div><dt>plan</dt><dd>free</dd></div>
      </dl>
    </div>
    <div class="stage fl-dots" role="img" aria-label="Placeholder product illustration">
      <div class="window">
        <div class="chrome"><span></span><span></span><span></span><b>yourbrand.app</b></div>
        <div class="page">
          <div class="nav"><i></i><i></i><i></i></div>
          <div class="headline">
            <div class="line"></div>
            <div class="line short"></div>
            ${selection}
          </div>
          <div class="text"></div>
          <div class="buttons"><i></i><i></i></div>
          <div class="tiles"><i></i><i></i><i></i></div>
        </div>
      </div>
      <div class="cursor">${px('cursor')}</div>
    </div>
  </div>
</section>`,
    css: [
      '.fl-hero-split{padding-block:var(--feega-space-section)}',
      '.fl-hero-split .grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);align-items:center;gap:var(--feega-space-16)}',
      '.fl-hero-split .copy{display:flex;flex-direction:column;align-items:flex-start;gap:var(--feega-space-6)}',
      '.fl-hero-split .cta{display:flex;flex-wrap:wrap;gap:var(--feega-space-2);margin-top:var(--feega-space-2)}',
      '.fl-hero-split .stats{display:flex;gap:var(--feega-space-8);margin-top:var(--feega-space-4);padding-top:var(--feega-space-6);border-top:1px solid var(--feega-line)}',
      '.fl-hero-split .stats dt{font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);letter-spacing:0;color:var(--feega-fg-subtle);text-transform:uppercase}',
      '.fl-hero-split .stats dd{margin:4px 0 0;font-size:var(--feega-text-xl);font-weight:500;letter-spacing:-0.04em}',
      '.fl-hero-split .stage{position:relative;display:grid;place-items:center;aspect-ratio:5/4;padding:var(--feega-space-8);border-radius:var(--feega-radius-lg);background-color:var(--feega-surface)}',
      '.fl-hero-split .window{width:100%;overflow:hidden;border-radius:var(--feega-radius-md);background:var(--feega-raised);box-shadow:var(--feega-shadow-float)}',
      '.fl-hero-split .chrome{display:flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-bottom:1px solid var(--feega-line)}',
      '.fl-hero-split .chrome span{width:8px;height:8px;border-radius:var(--feega-radius-full);background:var(--feega-line-strong)}',
      '.fl-hero-split .chrome b{margin-left:auto;margin-right:auto;font-family:var(--feega-font-mono);font-size:10px;font-weight:400;letter-spacing:0;color:var(--feega-fg-subtle)}',
      '.fl-hero-split .page{display:grid;gap:14px;padding:20px 24px 28px}',
      '.fl-hero-split .nav{display:flex;justify-content:flex-end;gap:8px}',
      '.fl-hero-split .nav i{width:28px;height:6px;border-radius:var(--feega-radius-full);background:var(--feega-line)}',
      '.fl-hero-split .headline{position:relative;display:grid;gap:8px;margin-top:12px}',
      '.fl-hero-split .line{height:22px;border-radius:var(--feega-radius-xs);background:var(--feega-fg)}',
      '.fl-hero-split .line.short{width:62%}',
      '.fl-hero-split .headline .sel{inset:-6px -8px}',
      '.fl-hero-split .text{width:80%;height:8px;border-radius:var(--feega-radius-full);background:var(--feega-line-strong)}',
      '.fl-hero-split .buttons{display:flex;gap:8px}',
      '.fl-hero-split .buttons i{width:72px;height:22px;border-radius:var(--feega-radius-full);background:var(--feega-accent)}',
      '.fl-hero-split .buttons i + i{background:transparent;box-shadow:inset 0 0 0 1px var(--feega-line-strong)}',
      '.fl-hero-split .tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px}',
      '.fl-hero-split .tiles i{aspect-ratio:4/3;border-radius:var(--feega-radius-sm);background:var(--feega-surface)}',
      ...selectionCss,
      '.fl-hero-split .cursor{position:absolute;right:9%;bottom:47%;color:var(--feega-fg);filter:drop-shadow(0 2px 2px var(--feega-overlay));animation:fl-hero-split-cursor 3.2s var(--feega-ease) infinite alternate}',
      '.fl-hero-split .cursor .fl-px{width:18px}',
      '@keyframes fl-hero-split-cursor{from{transform:translate(18px,22px)}to{transform:translate(0,0)}}',
      '@media (max-width:900px){.fl-hero-split .grid{grid-template-columns:minmax(0,1fr);gap:var(--feega-space-12)}.fl-hero-split .stage{padding:var(--feega-space-4)}}'
    ]
  },
  {
    id: 'logo-strip',
    mods: ['container', 'px'],
    markup: `<section class="fl-logo-strip" aria-label="Customers">
  <div class="fl-container inner">
    <p class="label">teams already shipping with it</p>
    <ul class="logos">
      <li aria-label="Placeholder logo A">${px('spark')}<span>company a</span></li>
      <li aria-label="Placeholder logo B">${px('grid')}<span>company b</span></li>
      <li aria-label="Placeholder logo C">${px('bolt')}<span>company c</span></li>
      <li aria-label="Placeholder logo D">${px('layers')}<span>company d</span></li>
      <li aria-label="Placeholder logo E">${px('mark')}<span>company e</span></li>
      <li aria-label="Placeholder logo F">${px('chart')}<span>company f</span></li>
    </ul>
  </div>
</section>`,
    css: [
      '.fl-logo-strip{padding-block:var(--feega-space-12)}',
      '.fl-logo-strip .inner{display:grid;gap:var(--feega-space-6)}',
      '.fl-logo-strip .label{font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);letter-spacing:0.02em;color:var(--feega-fg-subtle);text-align:center;text-transform:uppercase}',
      '.fl-logo-strip .logos{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));padding:0;border-block:1px solid var(--feega-line);list-style:none}',
      '.fl-logo-strip li{display:flex;align-items:center;justify-content:center;gap:10px;min-height:88px;color:var(--feega-fg-subtle);font-size:1.0625rem;font-weight:600;letter-spacing:-0.04em;white-space:nowrap;transition:color var(--feega-dur) var(--feega-ease)}',
      '.fl-logo-strip li + li{border-left:1px solid var(--feega-line)}',
      '.fl-logo-strip li:hover{color:var(--feega-fg)}',
      '.fl-logo-strip li .fl-px{width:16px}',
      '@media (max-width:760px){.fl-logo-strip .logos{grid-template-columns:repeat(2,minmax(0,1fr))}.fl-logo-strip li + li{border-left:0}.fl-logo-strip li:nth-child(even){border-left:1px solid var(--feega-line)}.fl-logo-strip li:nth-child(n+3){border-top:1px solid var(--feega-line)}}'
    ]
  },
  {
    id: 'features-grid',
    mods: ['container', 'px', 'type'],
    markup: `<section class="fl-features-grid">
  <div class="fl-container">
    <div class="head">
      <p class="fl-eyebrow">features</p>
      <h2 class="fl-title">everything you need, nothing you don't</h2>
    </div>
    <ul class="grid">
      <li>${px('bolt')}<h3>fast by default</h3><p>Pages load in a blink and stay quick as the project grows.</p></li>
      <li>${px('cursor')}<h3>edit in place</h3><p>Click what you see and change it. No hunting through files.</p></li>
      <li>${px('layers')}<h3>built on your stack</h3><p>Works with the framework and the styles you already use.</p></li>
      <li>${px('lock')}<h3>private by design</h3><p>Your data stays yours. Nothing leaves without you asking.</p></li>
      <li>${px('chat')}<h3>made for teams</h3><p>Comments, reviews and roles, right where the work happens.</p></li>
      <li>${px('chart')}<h3>clear numbers</h3><p>See what changed and what it did, without a separate tool.</p></li>
    </ul>
  </div>
</section>`,
    css: [
      '.fl-features-grid{padding-block:var(--feega-space-section)}',
      '.fl-features-grid .head{display:grid;gap:var(--feega-space-6);max-width:44rem;margin-bottom:var(--feega-space-16)}',
      '.fl-features-grid .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;padding:0;border:1px solid var(--feega-line);border-radius:var(--feega-radius-lg);overflow:hidden;background:var(--feega-line);list-style:none}',
      '.fl-features-grid li{display:grid;align-content:start;gap:var(--feega-space-2);padding:var(--feega-space-8);background:var(--feega-bg);transition:background-color var(--feega-dur) var(--feega-ease)}',
      '.fl-features-grid li:hover{background:var(--feega-surface)}',
      '.fl-features-grid li .fl-px{width:28px;margin-bottom:var(--feega-space-8);color:var(--feega-accent);transition:transform var(--feega-dur) var(--feega-ease)}',
      '.fl-features-grid li:hover .fl-px{transform:translateY(-3px)}',
      '.fl-features-grid h3{font-size:1.125rem;font-weight:500;letter-spacing:-0.03em}',
      '.fl-features-grid li p{color:var(--feega-fg-muted);text-wrap:pretty}',
      '@media (max-width:900px){.fl-features-grid .grid{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '@media (max-width:600px){.fl-features-grid .grid{grid-template-columns:minmax(0,1fr)}.fl-features-grid li{padding:var(--feega-space-6)}.fl-features-grid li .fl-px{margin-bottom:var(--feega-space-4)}}'
    ]
  },
  {
    id: 'feature-image',
    mods: ['container', 'px', 'btn', 'type', 'dots'],
    markup: `<section class="fl-feature-image">
  <div class="fl-container grid">
    <div class="stage fl-dots" role="img" aria-label="Placeholder chart illustration">
      <div class="panel">
        <div class="top"><span>weekly active</span><b>+24%</b></div>
        <p class="value">12,480</p>
        <div class="bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      </div>
      <div class="chip">${px('check')}synced just now</div>
    </div>
    <div class="copy">
      <p class="fl-eyebrow">insights</p>
      <h2 class="fl-title">know what moved, and why</h2>
      <p class="fl-lead">One paragraph on the outcome this feature gives. Lead with the benefit, then the detail that makes it believable.</p>
      <ul class="points">
        <li>${px('check')}live numbers, no exports</li>
        <li>${px('check')}alerts when a metric slips</li>
        <li>${px('check')}share a view with one link</li>
      </ul>
      <a class="fl-btn" href="#">explore insights ${px('arrow')}</a>
    </div>
  </div>
</section>`,
    css: [
      '.fl-feature-image{padding-block:var(--feega-space-section)}',
      '.fl-feature-image .grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);align-items:center;gap:var(--feega-space-16)}',
      '.fl-feature-image .copy{display:flex;flex-direction:column;align-items:flex-start;gap:var(--feega-space-6)}',
      '.fl-feature-image .points{display:grid;gap:var(--feega-space-3);padding:0;list-style:none;font-weight:500}',
      '.fl-feature-image .points li{display:flex;align-items:center;gap:var(--feega-space-3)}',
      '.fl-feature-image .points .fl-px{width:12px;color:var(--feega-accent)}',
      '.fl-feature-image .stage{position:relative;display:grid;place-items:center;aspect-ratio:1/1;padding:var(--feega-space-12);border-radius:var(--feega-radius-lg);background-color:var(--feega-surface)}',
      '.fl-feature-image .panel{width:100%;padding:var(--feega-space-6);border-radius:var(--feega-radius-md);background:var(--feega-raised);box-shadow:var(--feega-shadow-float)}',
      '.fl-feature-image .top{display:flex;justify-content:space-between;font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);letter-spacing:0;color:var(--feega-fg-subtle);text-transform:uppercase}',
      '.fl-feature-image .top b{font-weight:400;color:var(--feega-success)}',
      '.fl-feature-image .value{margin-top:var(--feega-space-2);font-size:clamp(2rem,4vw,3rem);font-weight:500;letter-spacing:var(--feega-tracking-tight)}',
      '.fl-feature-image .bars{display:flex;align-items:flex-end;gap:6px;height:120px;margin-top:var(--feega-space-6)}',
      '.fl-feature-image .bars i{flex:1;height:var(--h);border-radius:var(--feega-radius-xs) var(--feega-radius-xs) 0 0;background:var(--feega-line-strong);transform-origin:bottom;animation:fl-feature-image-grow var(--feega-dur) var(--feega-ease) backwards}',
      '.fl-feature-image .bars i:nth-child(1){--h:30%}',
      '.fl-feature-image .bars i:nth-child(2){--h:42%}',
      '.fl-feature-image .bars i:nth-child(3){--h:36%}',
      '.fl-feature-image .bars i:nth-child(4){--h:50%}',
      '.fl-feature-image .bars i:nth-child(5){--h:46%}',
      '.fl-feature-image .bars i:nth-child(6){--h:58%}',
      '.fl-feature-image .bars i:nth-child(7){--h:54%}',
      '.fl-feature-image .bars i:nth-child(8){--h:66%}',
      '.fl-feature-image .bars i:nth-child(9){--h:62%}',
      '.fl-feature-image .bars i:nth-child(10){--h:74%}',
      '.fl-feature-image .bars i:nth-child(11){--h:84%}',
      '.fl-feature-image .bars i:nth-child(12){--h:100%;background:var(--feega-accent)}',
      '@keyframes fl-feature-image-grow{from{transform:scaleY(0)}}',
      '.fl-feature-image .chip{position:absolute;right:var(--feega-space-6);bottom:var(--feega-space-6);display:inline-flex;align-items:center;gap:8px;min-height:32px;padding:0 12px;border-radius:var(--feega-radius-full);background:var(--feega-raised);box-shadow:var(--feega-shadow);font-size:var(--feega-text-xs);font-weight:500}',
      '.fl-feature-image .chip .fl-px{width:10px;color:var(--feega-success)}',
      '@media (max-width:900px){.fl-feature-image .grid{grid-template-columns:minmax(0,1fr);gap:var(--feega-space-12)}.fl-feature-image .stage{order:2;aspect-ratio:auto;padding:var(--feega-space-6) var(--feega-space-4) var(--feega-space-16)}}'
    ]
  },
  {
    id: 'quote-block',
    mods: ['container', 'px', 'avatar'],
    markup: `<section class="fl-quote-block">
  <figure class="fl-container inner">
    ${px('quote')}
    <blockquote>
      <p>Replace this with a real quote from a customer. Keep it short, specific, and in their own words.</p>
    </blockquote>
    <figcaption>
      <span class="fl-avatar" aria-hidden="true">NS</span>
      <span class="who"><b>Name Surname</b><span>Role, Company</span></span>
    </figcaption>
  </figure>
</section>`,
    css: [
      '.fl-quote-block{padding-block:var(--feega-space-section)}',
      '.fl-quote-block .inner{display:grid;justify-items:start;gap:var(--feega-space-8);max-width:60rem}',
      '.fl-quote-block .inner > .fl-px{width:28px;color:var(--feega-accent)}',
      '.fl-quote-block blockquote p{font-family:var(--feega-font-display);font-size:clamp(1.875rem,4.4vw,3.25rem);font-weight:500;line-height:1.05;letter-spacing:-0.045em;text-wrap:balance}',
      '.fl-quote-block figcaption{display:flex;align-items:center;gap:var(--feega-space-3)}',
      '.fl-quote-block .fl-avatar{width:44px;height:44px}',
      '.fl-quote-block .who{display:grid;font-size:var(--feega-text-sm)}',
      '.fl-quote-block .who b{font-weight:600}',
      '.fl-quote-block .who span{color:var(--feega-fg-muted)}'
    ]
  },
  {
    id: 'pricing',
    mods: ['container', 'px', 'btn', 'type'],
    markup: `<section class="fl-pricing">
  <div class="fl-container">
    <div class="head">
      <h2 class="fl-title">pricing</h2>
      <p class="fl-lead">Start free. Pay when the team grows. Every plan has every core feature.</p>
    </div>
    <div class="tiers">
      <article>
        <h3>starter</h3>
        <p class="price"><strong>$0</strong><span>forever</span></p>
        <p class="note">For trying it out on a side project.</p>
        <a class="fl-btn" href="#">start free</a>
        <ul>
          <li>${px('check')}up to 3 projects</li>
          <li>${px('check')}community support</li>
          <li>${px('check')}1 GB storage</li>
        </ul>
      </article>
      <article class="featured">
        <h3>pro <span class="tag">popular</span></h3>
        <p class="price"><strong>$12</strong><span>per seat / month</span></p>
        <p class="note">For small teams shipping every week.</p>
        <a class="fl-btn fl-btn--primary" href="#">start 14-day trial</a>
        <ul>
          <li>${px('check')}unlimited projects</li>
          <li>${px('check')}custom domain</li>
          <li>${px('check')}priority support</li>
        </ul>
      </article>
      <article>
        <h3>business</h3>
        <p class="price"><strong>$49</strong><span>per seat / month</span></p>
        <p class="note">For companies with security reviews.</p>
        <a class="fl-btn" href="#">talk to sales</a>
        <ul>
          <li>${px('check')}SSO and audit log</li>
          <li>${px('check')}roles and permissions</li>
          <li>${px('check')}dedicated onboarding</li>
        </ul>
      </article>
    </div>
  </div>
</section>`,
    css: [
      '.fl-pricing{padding-block:var(--feega-space-section)}',
      '.fl-pricing .head{display:grid;gap:var(--feega-space-6);margin-bottom:var(--feega-space-16)}',
      '.fl-pricing .head .fl-title{font-size:var(--feega-text-display)}',
      '.fl-pricing .tiers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--feega-space-3)}',
      '.fl-pricing article{display:flex;flex-direction:column;gap:var(--feega-space-6);padding:var(--feega-space-8);border-radius:var(--feega-radius-lg);background:var(--feega-surface);transition:transform var(--feega-dur) var(--feega-ease)}',
      '.fl-pricing article:hover{transform:translateY(-4px)}',
      '.fl-pricing article.featured{background:var(--feega-raised);box-shadow:var(--feega-shadow-float),inset 0 0 0 1px var(--feega-accent)}',
      '.fl-pricing h3{display:flex;align-items:center;justify-content:space-between;font-size:var(--feega-text-xl);font-weight:500;letter-spacing:-0.04em}',
      '.fl-pricing .tag{padding:4px 10px;border-radius:var(--feega-radius-full);background:var(--feega-accent-soft);color:var(--feega-accent-text);font-size:var(--feega-text-xs);letter-spacing:0}',
      '.fl-pricing .price{display:flex;align-items:baseline;gap:var(--feega-space-2)}',
      '.fl-pricing .price strong{font-size:clamp(3rem,6vw,4.5rem);font-weight:500;line-height:0.9;letter-spacing:var(--feega-tracking-tight)}',
      '.fl-pricing .price span{color:var(--feega-fg-muted);font-size:var(--feega-text-sm)}',
      '.fl-pricing .note{margin-top:calc(var(--feega-space-2) * -1);color:var(--feega-fg-muted)}',
      '.fl-pricing ul{display:grid;gap:var(--feega-space-3);padding:var(--feega-space-6) 0 0;border-top:1px solid var(--feega-line);list-style:none;font-size:var(--feega-text-sm);font-weight:500}',
      '.fl-pricing li{display:flex;align-items:center;gap:var(--feega-space-3)}',
      '.fl-pricing li .fl-px{width:11px;color:var(--feega-accent)}',
      '@media (max-width:900px){.fl-pricing .tiers{grid-template-columns:minmax(0,1fr)}.fl-pricing article{padding:var(--feega-space-6)}}'
    ]
  },
  {
    id: 'faq',
    mods: ['container', 'px', 'type'],
    markup: `<section class="fl-faq">
  <div class="fl-container grid">
    <div class="head">
      <h2 class="fl-title">questions, answered</h2>
      <p class="fl-lead">Still stuck? <a href="#">Write to support</a>, a person replies within a day.</p>
    </div>
    <div class="list">
      <details name="fl-faq" open>
        <summary>Is there a free plan?${px('plus')}</summary>
        <p>Yes. The starter plan is free forever and has every core feature. Upgrade only when you need more seats or storage.</p>
      </details>
      <details name="fl-faq">
        <summary>Can I cancel anytime?${px('plus')}</summary>
        <p>Yes. Cancel from settings in two clicks. You keep access until the end of the billing period.</p>
      </details>
      <details name="fl-faq">
        <summary>Where is my data stored?${px('plus')}</summary>
        <p>In encrypted storage in the region you pick at sign up. You can export everything at any time.</p>
      </details>
      <details name="fl-faq">
        <summary>Do you offer discounts for education?${px('plus')}</summary>
        <p>Students, teachers and non-profits get the pro plan at half price. Write to support with proof of status.</p>
      </details>
    </div>
  </div>
</section>`,
    css: [
      '.fl-faq{padding-block:var(--feega-space-section)}',
      '.fl-faq .grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:var(--feega-space-16)}',
      '.fl-faq .head{display:grid;align-content:start;gap:var(--feega-space-6)}',
      '.fl-faq .head a{color:var(--feega-fg);text-decoration:underline;text-decoration-color:var(--feega-line-strong);text-underline-offset:4px;transition:text-decoration-color var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-faq .head a:hover{text-decoration-color:var(--feega-accent)}',
      '.fl-faq .list{border-top:1px solid var(--feega-line)}',
      '.fl-faq details{border-bottom:1px solid var(--feega-line)}',
      '.fl-faq summary{display:flex;align-items:center;justify-content:space-between;gap:var(--feega-space-6);padding:var(--feega-space-6) 0;font-size:1.125rem;font-weight:500;letter-spacing:-0.03em;list-style:none;cursor:pointer;transition:color var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-faq summary::-webkit-details-marker{display:none}',
      '.fl-faq summary:hover{color:var(--feega-accent-text)}',
      '.fl-faq summary .fl-px{width:12px;color:var(--feega-fg-subtle);transition:transform var(--feega-dur) var(--feega-ease),color var(--feega-dur) var(--feega-ease)}',
      '.fl-faq details[open] summary .fl-px{color:var(--feega-accent);transform:rotate(45deg)}',
      '.fl-faq details p{max-width:36rem;padding-bottom:var(--feega-space-6);color:var(--feega-fg-muted);animation:fl-faq-in var(--feega-dur) var(--feega-ease)}',
      '@keyframes fl-faq-in{from{opacity:0;transform:translateY(-6px)}}',
      '@media (max-width:900px){.fl-faq .grid{grid-template-columns:minmax(0,1fr);gap:var(--feega-space-12)}}'
    ]
  },
  {
    id: 'cta-band',
    mods: ['container', 'px', 'btn'],
    markup: `<section class="fl-cta-band">
  <div class="fl-container">
    <div class="band">
      <div class="field" aria-hidden="true"></div>
      <h2>ready when you are</h2>
      <p>Set up in two minutes. Free until your team grows.</p>
      <div class="cta">
        <a class="fl-btn fl-btn--primary" href="#">get started free</a>
        <a class="fl-btn on-ink" href="#">talk to us ${px('arrow')}</a>
      </div>
    </div>
  </div>
</section>`,
    css: [
      '.fl-cta-band{padding-block:var(--feega-space-section)}',
      '.fl-cta-band .band{position:relative;display:flex;flex-direction:column;align-items:center;overflow:hidden;padding:clamp(3.5rem,9vw,7rem) var(--feega-space-6);border-radius:var(--feega-radius-lg);background:var(--feega-fg);color:var(--feega-bg);text-align:center}',
      '.fl-cta-band .field{position:absolute;inset:0;background-image:radial-gradient(color-mix(in srgb,var(--feega-bg) 22%,transparent) 1px,transparent 1.5px);background-size:14px 14px;-webkit-mask-image:radial-gradient(ellipse 70% 90% at 50% 100%,var(--feega-fg),transparent);mask-image:radial-gradient(ellipse 70% 90% at 50% 100%,var(--feega-fg),transparent)}',
      '.fl-cta-band h2{position:relative;max-width:12ch;font-family:var(--feega-font-display);font-size:var(--feega-text-display);font-weight:500;line-height:0.92;letter-spacing:var(--feega-tracking-tight);text-wrap:balance}',
      '.fl-cta-band p{position:relative;max-width:28rem;margin-top:var(--feega-space-6);font-size:var(--feega-text-lg);color:color-mix(in srgb,var(--feega-bg) 70%,transparent)}',
      '.fl-cta-band .cta{position:relative;display:flex;flex-wrap:wrap;justify-content:center;gap:var(--feega-space-3);margin-top:var(--feega-space-8)}',
      '.fl-cta-band .on-ink{border-color:color-mix(in srgb,var(--feega-bg) 30%,transparent);color:var(--feega-bg)}',
      '.fl-cta-band .on-ink:hover{border-color:var(--feega-bg);background:color-mix(in srgb,var(--feega-bg) 10%,transparent)}'
    ]
  },
  {
    id: 'footer',
    mods: ['container', 'px'],
    markup: `<footer class="fl-footer">
  <div class="fl-container">
    <div class="top">
      <div class="about">
        ${brand}
        <p>One line on what the product is and who it is for.</p>
        <p class="status"><span></span>all systems normal</p>
      </div>
      <nav aria-label="Footer" class="cols">
        <div><h3>product</h3><ul><li><a href="#">features</a></li><li><a href="#">pricing</a></li><li><a href="#">changelog</a></li><li><a href="#">roadmap</a></li></ul></div>
        <div><h3>company</h3><ul><li><a href="#">about</a></li><li><a href="#">blog</a></li><li><a href="#">careers</a></li><li><a href="#">contact</a></li></ul></div>
        <div><h3>resources</h3><ul><li><a href="#">docs</a></li><li><a href="#">guides</a></li><li><a href="#">support</a></li><li><a href="#">status</a></li></ul></div>
      </nav>
    </div>
    <p class="word" aria-hidden="true">yourbrand</p>
    <div class="bottom">
      <p>&copy; 2026 Yourbrand</p>
      <ul><li><a href="#">privacy</a></li><li><a href="#">terms</a></li><li><a href="#">cookies</a></li></ul>
    </div>
  </div>
</footer>`,
    css: [
      '.fl-footer{padding-top:var(--feega-space-16);border-top:1px solid var(--feega-line);overflow:hidden}',
      '.fl-footer .top{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:var(--feega-space-12)}',
      '.fl-footer .about{display:grid;align-content:start;justify-items:start;gap:var(--feega-space-4)}',
      ...brandCss,
      '.fl-footer .about > p{max-width:18rem;color:var(--feega-fg-muted)}',
      '.fl-footer .about .status{display:inline-flex;align-items:center;gap:8px;font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);letter-spacing:0;text-transform:uppercase}',
      '.fl-footer .status span{width:6px;height:6px;border-radius:var(--feega-radius-full);background:var(--feega-success);box-shadow:0 0 0 3px var(--feega-success-soft)}',
      '.fl-footer .cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--feega-space-8)}',
      '.fl-footer h3{margin-bottom:var(--feega-space-4);font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);font-weight:400;letter-spacing:0.02em;color:var(--feega-fg-subtle);text-transform:uppercase}',
      '.fl-footer ul{display:grid;gap:var(--feega-space-2);padding:0;list-style:none}',
      '.fl-footer .cols a{font-weight:500;transition:color var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-footer .cols a:hover{color:var(--feega-accent-text)}',
      '.fl-footer .word{margin-top:var(--feega-space-16);font-family:var(--feega-font-display);font-size:clamp(4rem,19vw,16rem);font-weight:500;line-height:0.78;letter-spacing:-0.06em;color:var(--feega-surface);white-space:nowrap;user-select:none}',
      '.fl-footer .bottom{display:flex;flex-wrap:wrap;justify-content:space-between;gap:var(--feega-space-4);padding-block:var(--feega-space-6);border-top:1px solid var(--feega-line);font-size:var(--feega-text-sm);color:var(--feega-fg-muted)}',
      '.fl-footer .bottom ul{display:flex;gap:var(--feega-space-6)}',
      '.fl-footer .bottom a:hover{color:var(--feega-fg)}',
      '@media (max-width:760px){.fl-footer .top{grid-template-columns:minmax(0,1fr)}.fl-footer .cols{grid-template-columns:repeat(2,minmax(0,1fr))}}'
    ]
  }
];
