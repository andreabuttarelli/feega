import { px } from './kit.mjs';

const head = (eyebrow, title, lead = '') => `<div class="fl-container head">
    <p class="fl-eyebrow">${eyebrow}</p>
    <h2 class="fl-title">${title}</h2>${lead ? `\n    <p class="fl-lead">${lead}</p>` : ''}
  </div>`;
const headCss = (c) => [
  `.${c}{padding-block:var(--feega-space-section)}`,
  `.${c} .head{display:flex;flex-direction:column;align-items:flex-start;gap:var(--feega-space-6);margin-bottom:var(--feega-space-12)}`
];

export const blocks = [
  {
    id: 'bento-grid',
    name: 'Bento feature grid',
    description: 'Six features in tiles of different sizes, each with a small pixel illustration.',
    category: 'section',
    tags: ['features', 'bento', 'grid'],
    mods: ['container', 'px', 'type', 'dots'],
    markup: `<section class="fl-bento-grid">
  ${head('features', 'everything in one place')}
  <ul class="fl-container grid">
    <li class="big fl-dots"><div class="art"><span class="win"><i></i><i></i><i></i></span><span class="cur">${px('cursor')}</span></div><h3>edit where it runs</h3><p>Click anything on the live page and change it in place.</p></li>
    <li class="tall"><span class="ic">${px('bolt')}</span><h3>instant</h3><p>Changes show before you let go of the mouse.</p><div class="meter"><i></i></div></li>
    <li><span class="ic">${px('lock')}</span><h3>private</h3><p>Nothing leaves your machine.</p></li>
    <li><span class="ic">${px('layers')}</span><h3>your components</h3><p>Uses the ones you have.</p></li>
    <li class="wide accent"><span class="ic">${px('chart')}</span><h3>see what moved</h3><p>Every change gets a before and after.</p><b>+38%</b></li>
  </ul>
</section>`,
    css: [
      ...headCss('fl-bento-grid'),
      '.fl-bento-grid .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-rows:minmax(13rem,auto);gap:var(--feega-space-3);padding:0;list-style:none}',
      '.fl-bento-grid li{position:relative;display:flex;flex-direction:column;justify-content:flex-end;gap:var(--feega-space-2);overflow:hidden;padding:var(--feega-space-6);border-radius:var(--feega-radius-lg);background:var(--feega-surface);transition:transform var(--feega-dur) var(--feega-ease)}',
      '.fl-bento-grid li:hover{transform:translateY(-3px)}',
      '.fl-bento-grid h3{font-size:var(--feega-text-xl);font-weight:500;letter-spacing:-0.04em;line-height:1.1}',
      '.fl-bento-grid p{max-width:28ch;color:var(--feega-fg-muted)}',
      '.fl-bento-grid .ic{display:grid;place-items:center;width:40px;height:40px;margin-bottom:auto;border-radius:var(--feega-radius-md);background:var(--feega-raised);color:var(--feega-accent);box-shadow:var(--feega-shadow)}',
      '.fl-bento-grid .ic .fl-px{width:16px}',
      '.fl-bento-grid .big{grid-column:span 2;grid-row:span 2;background-color:var(--feega-surface)}',
      '.fl-bento-grid .art{position:relative;flex:1;display:grid;place-items:center;min-height:12rem}',
      '.fl-bento-grid .win{display:grid;gap:10px;width:min(70%,22rem);padding:20px;border-radius:var(--feega-radius-md);background:var(--feega-raised);box-shadow:var(--feega-shadow-float)}',
      '.fl-bento-grid .win i{height:12px;border-radius:var(--feega-radius-xs);background:var(--feega-surface)}',
      '.fl-bento-grid .win i:first-child{width:70%;height:22px;background:var(--feega-fg);outline:1px solid var(--feega-accent);outline-offset:4px}',
      '.fl-bento-grid .cur{position:absolute;left:62%;top:42%;color:var(--feega-fg);animation:fl-bento-grid-move 3.2s var(--feega-ease) infinite alternate}',
      '.fl-bento-grid .cur .fl-px{width:18px}',
      '@keyframes fl-bento-grid-move{from{transform:translate(30px,40px)}}',
      '.fl-bento-grid .meter{height:8px;margin-top:var(--feega-space-4);border-radius:var(--feega-radius-full);background:var(--feega-line)}',
      '.fl-bento-grid .meter i{display:block;width:86%;height:100%;border-radius:inherit;background:var(--feega-accent)}',
      '.fl-bento-grid .wide{grid-column:span 2}',
      '.fl-bento-grid .accent{background:var(--feega-fg);color:var(--feega-bg)}',
      '.fl-bento-grid .accent p{color:var(--feega-fg-subtle)}',
      '.fl-bento-grid .accent b{position:absolute;top:var(--feega-space-6);right:var(--feega-space-6);color:var(--feega-accent);font-size:clamp(2.5rem,5vw,4rem);font-weight:500;letter-spacing:var(--feega-tracking-tight);line-height:1}',
      '.fl-bento-grid .accent .ic{background:var(--feega-fg-muted);box-shadow:none}',
      '@media (max-width:900px){.fl-bento-grid .grid{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '@media (max-width:560px){.fl-bento-grid .grid{grid-template-columns:minmax(0,1fr)}.fl-bento-grid .big,.fl-bento-grid .wide{grid-column:auto}.fl-bento-grid .big{grid-row:auto}}'
    ]
  },
  {
    id: 'stats-band',
    name: 'Stats band',
    description: 'Four big numbers with labels in a single band; numbers are placeholders.',
    category: 'section',
    tags: ['stats', 'numbers', 'social-proof'],
    mods: ['container'],
    markup: `<section class="fl-stats-band">
  <dl class="fl-container grid">
    <div><dt>teams using it</dt><dd>12k<span>+</span></dd></div>
    <div><dt>pages shipped</dt><dd>3.4<span>m</span></dd></div>
    <div><dt>median setup</dt><dd>2<span>min</span></dd></div>
    <div><dt>uptime, last 90 days</dt><dd>99.9<span>%</span></dd></div>
  </dl>
  <p class="fl-container note">Placeholder figures. Replace with your own.</p>
</section>`,
    css: [
      '.fl-stats-band{padding-block:var(--feega-space-16)}',
      '.fl-stats-band .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-block:1px solid var(--feega-line)}',
      '.fl-stats-band .grid > div{display:flex;flex-direction:column-reverse;justify-content:flex-end;gap:var(--feega-space-3);padding:var(--feega-space-8) var(--feega-space-6)}',
      '.fl-stats-band .grid > div + div{border-left:1px solid var(--feega-line)}',
      '.fl-stats-band dt{font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);color:var(--feega-fg-muted);text-transform:uppercase}',
      '.fl-stats-band dd{font-size:clamp(3rem,6vw,5rem);font-weight:500;line-height:0.9;letter-spacing:var(--feega-tracking-tight)}',
      '.fl-stats-band dd span{color:var(--feega-accent)}',
      '.fl-stats-band .note{margin-top:var(--feega-space-3);color:var(--feega-fg-subtle);font-size:var(--feega-text-xs)}',
      '@media (max-width:820px){.fl-stats-band .grid{grid-template-columns:repeat(2,minmax(0,1fr))}.fl-stats-band .grid > div:nth-child(3){border-left:0}.fl-stats-band .grid > div:nth-child(n+3){border-top:1px solid var(--feega-line)}}',
      '@media (max-width:420px){.fl-stats-band .grid > div{padding:var(--feega-space-6) var(--feega-space-4)}}'
    ]
  },
  {
    id: 'steps',
    name: 'How it works',
    description: 'Three numbered steps joined by a line, each with a short title and sentence.',
    category: 'section',
    tags: ['steps', 'process', 'onboarding'],
    mods: ['container', 'px', 'type'],
    markup: `<section class="fl-steps">
  ${head('how it works', 'three steps, then done')}
  <ol class="fl-container list">
    <li><span class="n">01</span><span class="ic">${px('term')}</span><h3>install</h3><p>Run one command in your project. It finds the framework for you.</p></li>
    <li><span class="n">02</span><span class="ic">${px('cursor')}</span><h3>select</h3><p>Open the page and click the thing you want to change.</p></li>
    <li><span class="n">03</span><span class="ic">${px('check')}</span><h3>ship</h3><p>The change is in your source, ready for review.</p></li>
  </ol>
</section>`,
    css: [
      ...headCss('fl-steps'),
      '.fl-steps .list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--feega-space-8);padding:0;list-style:none;counter-reset:none}',
      '.fl-steps li{position:relative;display:grid;gap:var(--feega-space-3);padding-top:var(--feega-space-8);border-top:1px solid var(--feega-line-strong)}',
      '.fl-steps li::before{content:"";position:absolute;top:-4px;left:0;width:7px;height:7px;background:var(--feega-accent)}',
      '.fl-steps .n{font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);color:var(--feega-fg-subtle)}',
      '.fl-steps .ic{display:grid;place-items:center;width:52px;height:52px;margin-block:var(--feega-space-2);border-radius:var(--feega-radius-md);background:var(--feega-surface)}',
      '.fl-steps .ic .fl-px{width:18px}',
      '.fl-steps h3{font-size:clamp(1.75rem,3vw,2.25rem);font-weight:500;letter-spacing:-0.05em;line-height:1}',
      '.fl-steps p{max-width:30ch;color:var(--feega-fg-muted)}',
      '@media (max-width:820px){.fl-steps .list{grid-template-columns:minmax(0,1fr)}}'
    ]
  },
  {
    id: 'comparison-table',
    name: 'Comparison table',
    description: 'You versus two alternatives across six rows; scrolls sideways inside its card on phones.',
    category: 'section',
    tags: ['comparison', 'table', 'pricing'],
    mods: ['container', 'px', 'type'],
    markup: `<section class="fl-comparison-table">
  ${head('compare', 'why teams switch')}
  <div class="fl-container">
    <div class="scroll" tabindex="0" role="region" aria-label="Comparison">
      <table>
        <thead><tr><th scope="col">feature</th><th scope="col" class="us">yourbrand</th><th scope="col">tool a</th><th scope="col">tool b</th></tr></thead>
        <tbody>
          <tr><th scope="row">edits land in source</th><td class="us">${px('check', 'fl-px yes')}</td><td>${px('close', 'fl-px no')}</td><td>${px('close', 'fl-px no')}</td></tr>
          <tr><th scope="row">works with your components</th><td class="us">${px('check', 'fl-px yes')}</td><td>${px('check', 'fl-px yes')}</td><td>${px('close', 'fl-px no')}</td></tr>
          <tr><th scope="row">runs locally</th><td class="us">${px('check', 'fl-px yes')}</td><td>${px('close', 'fl-px no')}</td><td>${px('check', 'fl-px yes')}</td></tr>
          <tr><th scope="row">free plan</th><td class="us">${px('check', 'fl-px yes')}</td><td>${px('check', 'fl-px yes')}</td><td>${px('close', 'fl-px no')}</td></tr>
          <tr><th scope="row">setup time</th><td class="us">2 min</td><td>1 day</td><td>1 hour</td></tr>
          <tr><th scope="row">price per seat</th><td class="us">$0</td><td>$15</td><td>$25</td></tr>
        </tbody>
      </table>
    </div>
    <p class="note">Tool names and figures are placeholders.</p>
  </div>
</section>`,
    css: [
      ...headCss('fl-comparison-table'),
      '.fl-comparison-table .scroll{overflow-x:auto;border-radius:var(--feega-radius-lg);background:var(--feega-raised);box-shadow:inset 0 0 0 1px var(--feega-line)}',
      '.fl-comparison-table table{width:100%;min-width:34rem;border-collapse:collapse;font-size:var(--feega-text-sm)}',
      '.fl-comparison-table th,.fl-comparison-table td{padding:16px 20px;border-bottom:1px solid var(--feega-line);text-align:center}',
      '.fl-comparison-table tbody tr:last-child > *{border-bottom:0}',
      '.fl-comparison-table th[scope="row"],.fl-comparison-table thead th:first-child{text-align:left;font-weight:500}',
      '.fl-comparison-table thead th{font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);font-weight:400;color:var(--feega-fg-muted);text-transform:uppercase}',
      '.fl-comparison-table .us{background:var(--feega-accent-soft);color:var(--feega-accent-text);font-weight:600}',
      '.fl-comparison-table td .fl-px{display:inline-block;width:12px}',
      '.fl-comparison-table .yes{color:var(--feega-success)}',
      '.fl-comparison-table .us .yes{color:var(--feega-accent-text)}',
      '.fl-comparison-table .no{width:9px!important;color:var(--feega-fg-subtle)}',
      '.fl-comparison-table .note{margin-top:var(--feega-space-3);color:var(--feega-fg-subtle);font-size:var(--feega-text-xs)}'
    ]
  },
  {
    id: 'integrations-grid',
    name: 'Integrations grid',
    description: 'Tiles for the tools you connect to, each with a pixel mark, name and one line.',
    category: 'section',
    tags: ['integrations', 'grid', 'logos'],
    mods: ['container', 'px', 'type', 'btn'],
    markup: `<section class="fl-integrations-grid">
  ${head('integrations', 'plays well with your stack', 'Placeholder names. Swap in the tools you really connect to.')}
  <ul class="fl-container grid">
${[['bolt', 'tool a', 'Deploys'], ['layers', 'tool b', 'Design files'], ['chat', 'tool c', 'Team chat'], ['chart', 'tool d', 'Analytics'], ['globe', 'tool e', 'Hosting'], ['mail', 'tool f', 'Email'], ['file', 'tool g', 'Docs'], ['plug', 'tool h', 'Webhooks']].map(([i, n, d]) => `    <li><a href="#"><span class="ic">${px(i)}</span><b>${n}</b><small>${d}</small>${px('arrow', 'fl-px go')}</a></li>`).join('\n')}
  </ul>
  <div class="fl-container more"><a class="fl-btn" href="#">see all integrations ${px('arrow')}</a></div>
</section>`,
    css: [
      ...headCss('fl-integrations-grid'),
      '.fl-integrations-grid .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(14rem,100%),1fr));gap:var(--feega-space-3);padding:0;list-style:none}',
      '.fl-integrations-grid a{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:0 14px;padding:var(--feega-space-4);border-radius:var(--feega-radius-md);background:var(--feega-surface);transition:background-color var(--feega-dur-fast) var(--feega-ease),box-shadow var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-integrations-grid a:hover{background:var(--feega-raised);box-shadow:var(--feega-shadow)}',
      '.fl-integrations-grid .ic{grid-row:span 2;display:grid;place-items:center;width:44px;height:44px;border-radius:var(--feega-radius-sm);background:var(--feega-raised);color:var(--feega-fg)}',
      '.fl-integrations-grid a:hover .ic{color:var(--feega-accent)}',
      '.fl-integrations-grid .ic .fl-px{width:16px}',
      '.fl-integrations-grid b{font-weight:500}',
      '.fl-integrations-grid small{color:var(--feega-fg-muted);font-size:var(--feega-text-sm)}',
      '.fl-integrations-grid .go{position:absolute;top:50%;right:16px;width:10px;opacity:0;transform:translate(-6px,-50%);transition:opacity var(--feega-dur-fast) var(--feega-ease),transform var(--feega-dur) var(--feega-ease)}',
      '.fl-integrations-grid a:hover .go{opacity:1;transform:translate(0,-50%)}',
      '.fl-integrations-grid .more{margin-top:var(--feega-space-8)}'
    ]
  },
  {
    id: 'changelog',
    name: 'Changelog timeline',
    description: 'Dated entries on a vertical line with a tag and a short note each.',
    category: 'section',
    tags: ['changelog', 'timeline', 'updates'],
    mods: ['container', 'type', 'badge'],
    markup: `<section class="fl-changelog">
  ${head('changelog', 'what is new')}
  <ol class="fl-container list">
${[['2026-11-20', 'Nov 20, 2026', 'accent', 'new', 'Dark mode everywhere', 'Every page follows the system theme. Pick one in settings to override it.'], ['2026-11-12', 'Nov 12, 2026', 'success', 'improved', 'Faster first load', 'Pages open in half the time on slow connections.'], ['2026-11-03', 'Nov 3, 2026', 'danger', 'fixed', 'Export keeps your fonts', 'Exports no longer fall back to the system font.']].map(([iso, d, k, t, h, p]) => `    <li><time datetime="${iso}">${d}</time><div class="entry"><span class="fl-badge fl-badge--${k}">${t}</span><h3>${h}</h3><p>${p}</p></div></li>`).join('\n')}
  </ol>
</section>`,
    css: [
      ...headCss('fl-changelog'),
      '.fl-changelog .list{display:grid;padding:0;list-style:none}',
      '.fl-changelog li{display:grid;grid-template-columns:10rem minmax(0,1fr);gap:var(--feega-space-8)}',
      '.fl-changelog time{padding-top:var(--feega-space-6);font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);color:var(--feega-fg-muted);text-transform:uppercase}',
      '.fl-changelog .entry{position:relative;display:grid;justify-items:start;gap:var(--feega-space-2);padding:var(--feega-space-6) 0 var(--feega-space-8) var(--feega-space-8);border-left:1px solid var(--feega-line-strong)}',
      '.fl-changelog .entry::before{content:"";position:absolute;top:calc(var(--feega-space-6) + 8px);left:-4px;width:7px;height:7px;background:var(--feega-accent)}',
      '.fl-changelog h3{font-size:var(--feega-text-xl);font-weight:500;letter-spacing:-0.04em}',
      '.fl-changelog p{max-width:40rem;color:var(--feega-fg-muted)}',
      '@media (max-width:640px){.fl-changelog li{grid-template-columns:minmax(0,1fr);gap:0}.fl-changelog time{padding-left:var(--feega-space-8);border-left:1px solid var(--feega-line-strong)}.fl-changelog .entry{padding-top:var(--feega-space-2)}.fl-changelog .entry::before{top:-14px}}'
    ]
  },
  {
    id: 'team-grid',
    name: 'Team grid',
    description: 'Placeholder people with initials, role and a link; replace every name before publishing.',
    category: 'section',
    tags: ['team', 'about', 'people'],
    mods: ['container', 'type'],
    markup: `<section class="fl-team-grid">
  ${head('team', 'the people behind it', 'Placeholder people. Replace names, roles and photos.')}
  <ul class="fl-container grid">
${[['NS', 'Name Surname', 'Founder'], ['FL', 'First Last', 'Design'], ['AB', 'Alex Example', 'Engineering'], ['SP', 'Sam Placeholder', 'Engineering'], ['RS', 'Robin Sample', 'Growth'], ['KD', 'Kai Demo', 'Support']].map(([i, n, r]) => `    <li><span class="photo" aria-hidden="true">${i}</span><b>${n}</b><span class="role">${r}</span></li>`).join('\n')}
  </ul>
</section>`,
    css: [
      ...headCss('fl-team-grid'),
      '.fl-team-grid .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(11rem,100%),1fr));gap:var(--feega-space-8) var(--feega-space-4);padding:0;list-style:none}',
      '.fl-team-grid li{display:grid;gap:2px}',
      '.fl-team-grid .photo{display:grid;place-items:center;aspect-ratio:4/5;margin-bottom:var(--feega-space-3);border-radius:var(--feega-radius-md);background:var(--feega-surface);color:var(--feega-fg-subtle);font-size:clamp(2rem,4vw,3rem);font-weight:500;letter-spacing:-0.05em;transition:background-color var(--feega-dur) var(--feega-ease),color var(--feega-dur) var(--feega-ease)}',
      '.fl-team-grid li:hover .photo{background:var(--feega-accent);color:var(--feega-accent-fg)}',
      '.fl-team-grid b{font-weight:500}',
      '.fl-team-grid .role{color:var(--feega-fg-muted);font-size:var(--feega-text-sm)}'
    ]
  },
  {
    id: 'blog-cards',
    name: 'Blog cards',
    description: 'Three article cards with cover, tag, date, title and reading time.',
    category: 'section',
    tags: ['blog', 'articles', 'cards'],
    mods: ['container', 'px', 'type', 'dots'],
    markup: `<section class="fl-blog-cards">
  ${head('blog', 'latest writing')}
  <ul class="fl-container grid">
${[['guide', 'A clear title that says what the reader gets', 'layers'], ['story', 'How one team cut their release time in half', 'chart'], ['update', 'Everything that shipped this month', 'spark']].map(([t, h, i]) => `    <li><a href="#"><span class="cover fl-dots">${px(i)}</span><span class="meta"><em>${t}</em><time datetime="2026-11-20">Nov 20</time><span>5 min</span></span><h3>${h}</h3></a></li>`).join('\n')}
  </ul>
</section>`,
    css: [
      ...headCss('fl-blog-cards'),
      '.fl-blog-cards .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(18rem,100%),1fr));gap:var(--feega-space-8) var(--feega-space-4);padding:0;list-style:none}',
      '.fl-blog-cards a{display:grid;gap:var(--feega-space-3)}',
      '.fl-blog-cards .cover{display:grid;place-items:center;aspect-ratio:16/10;overflow:hidden;margin-bottom:var(--feega-space-2);border-radius:var(--feega-radius-md);background-color:var(--feega-surface);color:var(--feega-accent)}',
      '.fl-blog-cards .cover .fl-px{width:48px;transition:transform var(--feega-dur) var(--feega-ease)}',
      '.fl-blog-cards a:hover .cover .fl-px{transform:scale(1.15)}',
      '.fl-blog-cards .meta{display:flex;gap:var(--feega-space-3);font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);color:var(--feega-fg-subtle);text-transform:uppercase}',
      '.fl-blog-cards .meta em{font-style:normal;color:var(--feega-accent-text)}',
      '.fl-blog-cards h3{font-size:var(--feega-text-xl);font-weight:500;line-height:1.1;letter-spacing:-0.04em;text-wrap:balance}',
      '.fl-blog-cards a:hover h3{text-decoration:underline;text-decoration-color:var(--feega-accent);text-underline-offset:4px}'
    ]
  },
  {
    id: 'newsletter',
    name: 'Newsletter signup',
    description: 'Headline and an inline email form with consent note.',
    category: 'section',
    tags: ['newsletter', 'form', 'conversion'],
    mods: ['container', 'px', 'btn', 'field'],
    markup: `<section class="fl-newsletter">
  <div class="fl-container card">
    <div class="copy">
      <span class="ic">${px('mail')}</span>
      <h2>one useful email a month</h2>
      <p>What shipped, what we learned, nothing else.</p>
    </div>
    <form action="#">
      <label class="sr" for="fl-newsletter-email">Email</label>
      <div class="row"><input class="fl-input" id="fl-newsletter-email" type="email" placeholder="you@example.com" autocomplete="email" required /><button class="fl-btn fl-btn--primary" type="submit">subscribe</button></div>
      <small>No spam. Unsubscribe in one click.</small>
    </form>
  </div>
</section>`,
    css: [
      '.fl-newsletter{padding-block:var(--feega-space-16)}',
      '.fl-newsletter .card{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center;gap:var(--feega-space-8);padding:clamp(1.5rem,5vw,3.5rem);border-radius:var(--feega-radius-lg);background:var(--feega-surface)}',
      '.fl-newsletter .copy{display:grid;justify-items:start;gap:var(--feega-space-3)}',
      '.fl-newsletter .ic{display:grid;place-items:center;width:44px;height:44px;margin-bottom:var(--feega-space-2);border-radius:var(--feega-radius-md);background:var(--feega-accent);color:var(--feega-accent-fg)}',
      '.fl-newsletter .ic .fl-px{width:18px}',
      '.fl-newsletter h2{font-size:clamp(2rem,4vw,3rem);font-weight:500;line-height:0.95;letter-spacing:var(--feega-tracking-tight);text-wrap:balance}',
      '.fl-newsletter p{color:var(--feega-fg-muted)}',
      '.fl-newsletter form{display:grid;gap:var(--feega-space-3)}',
      '.fl-newsletter .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}',
      '.fl-newsletter .row{display:flex;gap:var(--feega-space-2)}',
      '.fl-newsletter .row .fl-input{flex:1;min-width:0;border-radius:var(--feega-radius-full)}',
      '.fl-newsletter small{color:var(--feega-fg-subtle);font-size:var(--feega-text-xs)}',
      '@media (max-width:820px){.fl-newsletter .card{grid-template-columns:minmax(0,1fr)}}',
      '@media (max-width:420px){.fl-newsletter .row{flex-direction:column}}'
    ]
  },
  {
    id: 'contact-form',
    name: 'Contact form',
    description: 'Contact details beside a form with name, email, topic and message.',
    category: 'section',
    tags: ['contact', 'form'],
    mods: ['container', 'px', 'btn', 'type', 'field'],
    markup: `<section class="fl-contact-form">
  <div class="fl-container grid">
    <div class="copy">
      <p class="fl-eyebrow">contact</p>
      <h2 class="fl-title">talk to a person</h2>
      <p class="fl-lead">We answer within one working day.</p>
      <ul>
        <li>${px('mail')}<a href="#">hi@example.com</a></li>
        <li>${px('chat')}<a href="#">live chat, 9 to 6</a></li>
        <li>${px('globe')}<span>Placeholder City, Country</span></li>
      </ul>
    </div>
    <form class="form" action="#">
      <div class="two">
        <label class="fl-field" for="fl-contact-name">Name<input class="fl-input" id="fl-contact-name" type="text" autocomplete="name" placeholder="Name Surname" required /></label>
        <label class="fl-field" for="fl-contact-email">Email<input class="fl-input" id="fl-contact-email" type="email" autocomplete="email" placeholder="you@example.com" required /></label>
      </div>
      <label class="fl-field" for="fl-contact-topic">Topic<select class="fl-input" id="fl-contact-topic"><option>Sales</option><option>Support</option><option>Press</option></select></label>
      <label class="fl-field" for="fl-contact-message">Message<textarea class="fl-input" id="fl-contact-message" rows="5" placeholder="How can we help?" required></textarea></label>
      <button class="fl-btn fl-btn--primary" type="submit">send message ${px('arrow')}</button>
    </form>
  </div>
</section>`,
    css: [
      '.fl-contact-form{padding-block:var(--feega-space-section)}',
      '.fl-contact-form .grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:var(--feega-space-16)}',
      '.fl-contact-form .copy{display:flex;flex-direction:column;align-items:flex-start;gap:var(--feega-space-6)}',
      '.fl-contact-form ul{display:grid;gap:var(--feega-space-3);margin-top:var(--feega-space-4);padding:0;list-style:none;font-weight:500}',
      '.fl-contact-form li{display:flex;align-items:center;gap:var(--feega-space-3)}',
      '.fl-contact-form li .fl-px{width:14px;color:var(--feega-accent)}',
      '.fl-contact-form li a{border-bottom:1px solid var(--feega-line-strong)}',
      '.fl-contact-form .form{display:grid;gap:var(--feega-space-4);padding:clamp(1.25rem,4vw,2.5rem);border-radius:var(--feega-radius-lg);background:var(--feega-surface)}',
      '.fl-contact-form .two{display:grid;align-items:start;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--feega-space-4)}',
      '.fl-contact-form textarea.fl-input{padding-block:12px;resize:vertical}',
      '.fl-contact-form select.fl-input{height:44px;appearance:auto}',
      '.fl-contact-form .form .fl-btn{justify-self:start}',
      '@media (max-width:820px){.fl-contact-form .grid{grid-template-columns:minmax(0,1fr);gap:var(--feega-space-12)}}',
      '@media (max-width:480px){.fl-contact-form .two{grid-template-columns:minmax(0,1fr)}.fl-contact-form .form .fl-btn{justify-self:stretch}}'
    ]
  },
  {
    id: 'not-found',
    name: '404 page',
    description: 'Big pixel 404, one line of help and two ways back.',
    category: 'section',
    tags: ['404', 'error', 'page'],
    mods: ['px', 'btn', 'dots'],
    markup: `<section class="fl-not-found fl-dots">
  <div class="inner">
    <p class="code" aria-hidden="true">404</p>
    <h1>this page wandered off</h1>
    <p class="lead">The link may be old or mistyped. Try the home page or search.</p>
    <div class="cta"><a class="fl-btn fl-btn--primary" href="#">back home</a><a class="fl-btn" href="#">${px('search')} search</a></div>
  </div>
</section>`,
    css: [
      '.fl-not-found{display:grid;place-items:center;min-height:36rem;padding:var(--feega-space-16) var(--feega-gutter);background-color:var(--feega-bg);text-align:center}',
      '.fl-not-found .inner{display:grid;justify-items:center;gap:var(--feega-space-6)}',
      '.fl-not-found .code{font-family:var(--feega-font-mono);font-size:clamp(6rem,24vw,14rem);line-height:0.85;letter-spacing:-0.06em;color:var(--feega-accent)}',
      '.fl-not-found h1{font-size:clamp(2rem,5vw,3.5rem);font-weight:500;line-height:0.95;letter-spacing:var(--feega-tracking-tight)}',
      '.fl-not-found .lead{max-width:26rem;color:var(--feega-fg-muted)}',
      '.fl-not-found .cta{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--feega-space-3)}',
      '.fl-not-found .cta .fl-px{width:12px}'
    ]
  },
  {
    id: 'announcement-bar',
    name: 'Announcement bar',
    description: 'Thin bar above the navbar for a launch or notice, with a link.',
    category: 'section',
    tags: ['banner', 'announcement'],
    mods: ['px'],
    markup: `<aside class="fl-announcement-bar" aria-label="Announcement">
  <a href="#"><span class="tag">new</span><span class="text">Version 2.0 is out, with dark mode and faster loads</span><span class="go">read more ${px('arrow')}</span></a>
</aside>`,
    css: [
      '.fl-announcement-bar{background:var(--feega-fg);color:var(--feega-bg)}',
      '.fl-announcement-bar a{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 12px;min-height:44px;padding:8px var(--feega-gutter);font-size:var(--feega-text-sm);font-weight:500;text-align:center}',
      '.fl-announcement-bar .tag{padding:1px 8px;border-radius:var(--feega-radius-full);background:var(--feega-accent);color:var(--feega-accent-fg);font-family:var(--feega-font-mono);font-size:11px;text-transform:uppercase}',
      '.fl-announcement-bar .go{display:inline-flex;align-items:center;gap:6px;color:var(--feega-accent)}',
      '.fl-announcement-bar .go .fl-px{width:9px;transition:transform var(--feega-dur) var(--feega-ease)}',
      '.fl-announcement-bar a:hover .go .fl-px{transform:translateX(4px)}'
    ]
  },
  {
    id: 'pricing-toggle',
    name: 'Pricing, monthly and annual',
    description: 'Three plans with a monthly or annual switch; pure CSS, no script needed.',
    category: 'section',
    tags: ['pricing', 'plans', 'toggle'],
    mods: ['container', 'px', 'btn', 'type', 'switch'],
    markup: `<section class="fl-pricing-toggle">
  <div class="fl-container head">
    <p class="fl-eyebrow">pricing</p>
    <h2 class="fl-title">simple pricing</h2>
    <label class="bill">monthly <input class="fl-switch" type="checkbox" aria-label="Bill annually" /> annual <span class="save">save 20%</span></label>
  </div>
  <ul class="fl-container plans">
${[['starter', '0', '0', 'For trying it out.', 'start free', ['3 projects', 'community support']], ['pro', '15', '12', 'For small teams shipping weekly.', 'start trial', ['unlimited projects', 'custom domain', 'priority support']], ['business', '49', '39', 'For security reviews and SSO.', 'talk to sales', ['SSO and audit log', 'roles', 'onboarding']]].map(([n, m, a, d, c, f], i) => `    <li class="${i === 1 ? 'plan hot' : 'plan'}">
      <h3>${n}</h3>
      <p class="price"><b class="m">$${m}</b><b class="a">$${a}</b><span>per seat / month</span></p>
      <p class="desc">${d}</p>
      <a class="fl-btn${i === 1 ? ' fl-btn--primary' : ''}" href="#">${c}</a>
      <ul>${f.map((x) => `<li>${px('check')}${x}</li>`).join('')}</ul>
    </li>`).join('\n')}
  </ul>
</section>`,
    css: [
      '.fl-pricing-toggle{padding-block:var(--feega-space-section)}',
      '.fl-pricing-toggle .head{display:flex;flex-direction:column;align-items:center;gap:var(--feega-space-6);margin-bottom:var(--feega-space-12);text-align:center}',
      '.fl-pricing-toggle .bill{display:inline-flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:var(--feega-space-3);font-weight:500;cursor:pointer}',
      '.fl-pricing-toggle .save{padding:2px 10px;border-radius:var(--feega-radius-full);background:var(--feega-accent-soft);color:var(--feega-accent-text);font-size:var(--feega-text-xs)}',
      '.fl-pricing-toggle .plans{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--feega-space-3);padding:0;list-style:none}',
      '.fl-pricing-toggle .plan{display:flex;flex-direction:column;gap:var(--feega-space-4);padding:var(--feega-space-8);border-radius:var(--feega-radius-lg);background:var(--feega-surface)}',
      '.fl-pricing-toggle .hot{background:var(--feega-raised);box-shadow:var(--feega-shadow-float),inset 0 0 0 1px var(--feega-accent)}',
      '.fl-pricing-toggle h3{font-size:var(--feega-text-xl);font-weight:500;letter-spacing:-0.04em}',
      '.fl-pricing-toggle .price{display:flex;align-items:baseline;gap:var(--feega-space-2);color:var(--feega-fg-muted);font-size:var(--feega-text-sm)}',
      '.fl-pricing-toggle .price b{color:var(--feega-fg);font-size:clamp(2.75rem,5vw,3.5rem);font-weight:500;line-height:1;letter-spacing:var(--feega-tracking-tight);animation:fl-pricing-toggle-in var(--feega-dur) var(--feega-ease)}',
      '@keyframes fl-pricing-toggle-in{from{opacity:0;transform:translateY(8px)}}',
      '.fl-pricing-toggle .a,.fl-pricing-toggle:has(.fl-switch:checked) .m{display:none}',
      '.fl-pricing-toggle:has(.fl-switch:checked) .a{display:inline}',
      '.fl-pricing-toggle .desc{color:var(--feega-fg-muted)}',
      '.fl-pricing-toggle .plan > ul{display:grid;gap:var(--feega-space-2);margin-top:var(--feega-space-2);padding:0;list-style:none;font-size:var(--feega-text-sm)}',
      '.fl-pricing-toggle .plan > ul li{display:flex;align-items:center;gap:10px}',
      '.fl-pricing-toggle .plan > ul .fl-px{width:11px;color:var(--feega-accent)}',
      '@media (max-width:900px){.fl-pricing-toggle .plans{grid-template-columns:minmax(0,1fr);max-width:28rem;margin-inline:auto}}'
    ]
  },
  {
    id: 'testimonials-grid',
    name: 'Testimonials grid',
    description: 'Masonry of short quotes, every one a clearly marked placeholder to replace.',
    category: 'section',
    tags: ['testimonials', 'social-proof', 'quotes'],
    mods: ['container', 'type', 'avatar'],
    markup: `<section class="fl-testimonials-grid">
  ${head('testimonials', 'what people say', 'Placeholder quotes. Use real words from real customers, with permission.')}
  <ul class="fl-container grid">
${[['Placeholder quote. Replace with a short, specific line from a customer.', 'NS', 'Name Surname', 'Role, Company A'], ['Placeholder. One concrete result beats three adjectives: what got faster, cheaper or simpler.', 'FL', 'First Last', 'Role, Company B'], ['Placeholder quote.', 'AE', 'Alex Example', 'Role, Company C'], ['Placeholder. Keep the customer’s own words and tone; edit only for length.', 'SP', 'Sam Placeholder', 'Role, Company D'], ['Placeholder quote about the moment it clicked.', 'RS', 'Robin Sample', 'Role, Company E'], ['Placeholder. Name the thing they used before, and why they stopped.', 'KD', 'Kai Demo', 'Role, Company F']].map(([q, i, n, r]) => `    <li><blockquote>${q}</blockquote><p class="who"><span class="fl-avatar" aria-hidden="true">${i}</span><span><b>${n}</b><small>${r}</small></span></p></li>`).join('\n')}
  </ul>
</section>`,
    css: [
      ...headCss('fl-testimonials-grid'),
      '.fl-testimonials-grid .grid{columns:3 18rem;column-gap:var(--feega-space-3);padding:0;list-style:none}',
      '.fl-testimonials-grid li{display:grid;gap:var(--feega-space-6);margin-bottom:var(--feega-space-3);padding:var(--feega-space-6);border-radius:var(--feega-radius-lg);background:var(--feega-surface);break-inside:avoid}',
      '.fl-testimonials-grid li:nth-child(3n+1){background:var(--feega-raised);box-shadow:inset 0 0 0 1px var(--feega-line)}',
      '.fl-testimonials-grid blockquote{margin:0;font-size:1.125rem;font-weight:500;line-height:1.35;letter-spacing:-0.03em}',
      '.fl-testimonials-grid blockquote::before{content:"“";display:block;height:0.6em;color:var(--feega-accent);font-size:2.5em;line-height:1}',
      '.fl-testimonials-grid .who{display:flex;align-items:center;gap:var(--feega-space-3);font-size:var(--feega-text-sm)}',
      '.fl-testimonials-grid .who span:last-child{display:grid}',
      '.fl-testimonials-grid .who b{font-weight:600}',
      '.fl-testimonials-grid .who small{color:var(--feega-fg-muted)}'
    ]
  },
  {
    id: 'gallery',
    name: 'Gallery showcase',
    description: 'A grid of placeholder frames for work, screenshots or customer sites, with captions.',
    category: 'section',
    tags: ['gallery', 'showcase', 'images'],
    mods: ['container', 'px', 'type', 'dots'],
    markup: `<section class="fl-gallery">
  ${head('showcase', 'made with yourbrand')}
  <ul class="fl-container grid">
${['project one', 'project two', 'project three', 'project four', 'project five'].map((n, i) => `    <li><a href="#"><span class="img fl-dots">${px('image')}<em>image placeholder</em></span><span class="cap"><b>${n}</b><small>example.com</small></span></a></li>`).join('\n')}
  </ul>
</section>`,
    css: [
      ...headCss('fl-gallery'),
      '.fl-gallery .grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:var(--feega-space-3);padding:0;list-style:none}',
      '.fl-gallery li{grid-column:span 2}',
      '.fl-gallery li:nth-child(-n+2){grid-column:span 3}',
      '.fl-gallery a{display:grid;gap:var(--feega-space-3)}',
      '.fl-gallery .img{position:relative;display:grid;place-items:center;aspect-ratio:4/3;overflow:hidden;border-radius:var(--feega-radius-md);background-color:var(--feega-surface);color:var(--feega-fg-subtle);transition:transform var(--feega-dur) var(--feega-ease)}',
      '.fl-gallery a:hover .img{transform:scale(0.985)}',
      '.fl-gallery .img .fl-px{width:36px}',
      '.fl-gallery .img em{position:absolute;left:12px;bottom:10px;font-family:var(--feega-font-mono);font-size:10px;font-style:normal;text-transform:uppercase}',
      '.fl-gallery .cap{display:flex;justify-content:space-between;gap:var(--feega-space-3);font-size:var(--feega-text-sm)}',
      '.fl-gallery .cap b{font-weight:500}',
      '.fl-gallery .cap small{color:var(--feega-fg-subtle)}',
      '@media (max-width:820px){.fl-gallery .grid{grid-template-columns:repeat(2,minmax(0,1fr))}.fl-gallery li,.fl-gallery li:nth-child(-n+2){grid-column:auto}.fl-gallery li:first-child{grid-column:1/-1}}',
      '@media (max-width:480px){.fl-gallery .grid{grid-template-columns:minmax(0,1fr)}}'
    ]
  },
  {
    id: 'faq-two-column',
    name: 'FAQ, two columns',
    description: 'Questions and answers laid out open in two columns, no accordion.',
    category: 'section',
    tags: ['faq', 'support'],
    mods: ['container', 'type'],
    markup: `<section class="fl-faq-two-column">
  ${head('faq', 'questions, answered')}
  <dl class="fl-container grid">
${[['Is there a free plan?', 'Yes. The starter plan is free forever and has every core feature.'], ['Can I cancel anytime?', 'Yes. Cancel from settings; you keep access until the period ends.'], ['Where is my data stored?', 'In the region you pick at signup. Placeholder: say which.'], ['Do you offer discounts?', 'Education and non-profit teams get 50% off. Write to us.'], ['Does it work with my framework?', 'Svelte, React, Vue and Astro today. Placeholder list.'], ['How do I get help?', 'Docs first, then chat. A person replies within a day.']].map(([q, a]) => `    <div><dt>${q}</dt><dd>${a}</dd></div>`).join('\n')}
  </dl>
</section>`,
    css: [
      ...headCss('fl-faq-two-column'),
      '.fl-faq-two-column .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--feega-space-8) var(--feega-space-16)}',
      '.fl-faq-two-column .grid > div{display:grid;gap:var(--feega-space-2);padding-top:var(--feega-space-6);border-top:1px solid var(--feega-line)}',
      '.fl-faq-two-column dt{font-size:1.125rem;font-weight:500;letter-spacing:-0.03em}',
      '.fl-faq-two-column dd{margin:0;color:var(--feega-fg-muted)}',
      '@media (max-width:720px){.fl-faq-two-column .grid{grid-template-columns:minmax(0,1fr)}}'
    ]
  },
  {
    id: 'cta-split',
    name: 'CTA, split',
    description: 'Headline left, two actions right, on an accent field.',
    category: 'section',
    tags: ['cta', 'conversion'],
    mods: ['container', 'px', 'btn'],
    markup: `<section class="fl-cta-split">
  <div class="fl-container card">
    <h2>start building today</h2>
    <div class="side">
      <p>Free while you try it. No card, no call.</p>
      <div class="cta"><a class="fl-btn fl-btn--ink" href="#">get started ${px('arrow')}</a><a class="fl-btn ghost" href="#">talk to us</a></div>
    </div>
  </div>
</section>`,
    css: [
      '.fl-cta-split{padding-block:var(--feega-space-16)}',
      '.fl-cta-split .card{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);align-items:end;gap:var(--feega-space-8);padding:clamp(1.75rem,6vw,4.5rem);border-radius:var(--feega-radius-lg);background:var(--feega-accent);color:var(--feega-accent-fg)}',
      '.fl-cta-split h2{font-size:clamp(2.75rem,7vw,5.5rem);font-weight:500;line-height:0.9;letter-spacing:var(--feega-tracking-tight);text-wrap:balance}',
      '.fl-cta-split .side{display:grid;gap:var(--feega-space-6);font-size:var(--feega-text-lg);font-weight:500}',
      '.fl-cta-split .cta{display:flex;flex-wrap:wrap;gap:var(--feega-space-3)}',
      '.fl-cta-split .ghost{border-color:var(--feega-accent-fg);color:var(--feega-accent-fg)}',
      '.fl-cta-split .ghost:hover{border-color:var(--feega-accent-fg);background:var(--feega-accent-hover)}',
      '@media (max-width:820px){.fl-cta-split .card{grid-template-columns:minmax(0,1fr)}}'
    ]
  },
  {
    id: 'cta-minimal',
    name: 'CTA, minimal',
    description: 'One line and a text link with an arrow, separated by hairlines.',
    category: 'section',
    tags: ['cta', 'minimal'],
    mods: ['container', 'px'],
    markup: `<section class="fl-cta-minimal">
  <a class="fl-container row" href="#">
    <span class="text">ready when you are</span>
    <span class="go">${px('arrow')}</span>
  </a>
</section>`,
    css: [
      '.fl-cta-minimal{padding-block:var(--feega-space-12)}',
      '.fl-cta-minimal .row{display:flex;align-items:center;justify-content:space-between;gap:var(--feega-space-6);padding-block:var(--feega-space-8);border-block:1px solid var(--feega-line)}',
      '.fl-cta-minimal .text{font-size:clamp(2.25rem,7vw,6rem);font-weight:500;line-height:0.95;letter-spacing:var(--feega-tracking-tight);transition:color var(--feega-dur) var(--feega-ease)}',
      '.fl-cta-minimal .go{display:grid;flex:none;place-items:center;width:clamp(56px,9vw,96px);aspect-ratio:1;border-radius:var(--feega-radius-full);background:var(--feega-accent);color:var(--feega-accent-fg);transition:transform var(--feega-dur) var(--feega-ease)}',
      '.fl-cta-minimal .go .fl-px{width:32%}',
      '.fl-cta-minimal .row:hover .go{transform:rotate(-45deg)}',
      '.fl-cta-minimal .row:hover .text{color:var(--feega-accent-text)}'
    ]
  }
];
