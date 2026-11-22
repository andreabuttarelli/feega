import { px } from './kit.mjs';

const pad = (c) => `.${c}{padding:var(--feega-space-6) var(--feega-gutter)}`;

export const pieces = [
  {
    id: 'stats-cards',
    name: 'Dashboard stats cards',
    description: 'Four metric cards with change badge and a tiny bar sparkline.',
    category: 'app',
    tags: ['dashboard', 'stats', 'cards'],
    mods: ['px', 'badge'],
    markup: `<section class="fl-stats-cards" aria-label="Key metrics">
${[['Revenue', '$48,210', 'success', '+8.2%'], ['Active users', '3,904', 'success', '+3.1%'], ['Conversion', '4.6%', 'danger', '−0.4%'], ['Open tickets', '27', 'accent', '5 new']].map(([l, v, k, d]) => `  <article class="card"><header><span>${l}</span><em class="fl-badge fl-badge--${k}">${d}</em></header><p class="v">${v}</p><div class="spark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>`).join('\n')}
</section>`,
    css: [
      '.fl-stats-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(14rem,100%),1fr));gap:var(--feega-space-3);padding:var(--feega-space-6) var(--feega-gutter)}',
      '.fl-stats-cards .card{display:grid;gap:var(--feega-space-3);padding:var(--feega-space-6);border-radius:var(--feega-radius-lg);background:var(--feega-raised);box-shadow:inset 0 0 0 1px var(--feega-line)}',
      '.fl-stats-cards header{display:flex;justify-content:space-between;align-items:center;gap:var(--feega-space-2);color:var(--feega-fg-muted);font-size:var(--feega-text-sm);font-weight:500}',
      '.fl-stats-cards em{font-style:normal}',
      '.fl-stats-cards .v{font-size:clamp(2rem,3.4vw,2.5rem);font-weight:500;line-height:1;letter-spacing:var(--feega-tracking-tight);font-variant-numeric:tabular-nums}',
      '.fl-stats-cards .spark{display:flex;align-items:flex-end;gap:3px;height:32px}',
      '.fl-stats-cards .spark i{flex:1;height:var(--h);border-radius:1px;background:var(--feega-line-strong)}',
      ...[30, 45, 38, 52, 48, 60, 55, 68, 74, 90].map((h, i) => `.fl-stats-cards .spark i:nth-child(${i + 1}){--h:${h}%}`),
      '.fl-stats-cards .spark i:last-child{background:var(--feega-accent)}'
    ]
  },
  {
    id: 'dropdown-menu',
    name: 'Dropdown menu',
    description: 'Button that opens a menu with icons, shortcuts, a divider and a danger item; native details, no script.',
    category: 'component',
    tags: ['menu', 'dropdown', 'overlay'],
    mods: ['px', 'btn'],
    markup: `<div class="fl-dropdown-menu">
  <details>
    <summary class="fl-btn fl-btn--sm">Options ${px('chevron')}</summary>
    <ul class="menu" role="menu">
      <li role="none"><a role="menuitem" href="#">${px('file')}Rename<kbd>R</kbd></a></li>
      <li role="none"><a role="menuitem" href="#">${px('layers')}Duplicate<kbd>⌘D</kbd></a></li>
      <li role="none"><a role="menuitem" href="#">${px('globe')}Share<kbd>⌘S</kbd></a></li>
      <li class="sep" role="separator"></li>
      <li role="none"><a class="danger" role="menuitem" href="#">${px('close')}Delete<kbd>⌫</kbd></a></li>
    </ul>
  </details>
</div>`,
    css: [
      '.fl-dropdown-menu{min-height:16rem;padding:var(--feega-space-6) var(--feega-gutter)}',
      '.fl-dropdown-menu details{position:relative;display:inline-block}',
      '.fl-dropdown-menu summary{list-style:none}',
      '.fl-dropdown-menu summary::-webkit-details-marker{display:none}',
      '.fl-dropdown-menu summary .fl-px{width:8px;transition:transform var(--feega-dur) var(--feega-ease)}',
      '.fl-dropdown-menu details[open] summary .fl-px{transform:rotate(180deg)}',
      '.fl-dropdown-menu .menu{position:absolute;top:calc(100% + 6px);left:0;z-index:10;display:grid;width:min(14rem,calc(100vw - 2 * var(--feega-gutter)));margin:0;padding:6px;border-radius:var(--feega-radius-md);background:var(--feega-raised);box-shadow:var(--feega-shadow-float),inset 0 0 0 1px var(--feega-line);list-style:none;transform-origin:top left;animation:fl-dropdown-menu-in var(--feega-dur) var(--feega-ease)}',
      '@keyframes fl-dropdown-menu-in{from{opacity:0;transform:scale(0.96) translateY(-4px)}}',
      '.fl-dropdown-menu .menu a{display:flex;align-items:center;gap:10px;height:34px;padding:0 10px;border-radius:var(--feega-radius-sm);font-size:var(--feega-text-sm);font-weight:500}',
      '.fl-dropdown-menu .menu a:hover,.fl-dropdown-menu .menu a:focus-visible{background:var(--feega-surface);outline:none}',
      '.fl-dropdown-menu .menu .fl-px{width:12px;color:var(--feega-fg-subtle)}',
      '.fl-dropdown-menu kbd{margin-left:auto;font-family:var(--feega-font-mono);font-size:11px;color:var(--feega-fg-subtle)}',
      '.fl-dropdown-menu .sep{height:1px;margin:6px 4px;background:var(--feega-line)}',
      '.fl-dropdown-menu .danger,.fl-dropdown-menu .danger .fl-px{color:var(--feega-danger)}',
      '.fl-dropdown-menu .menu .danger:hover{background:var(--feega-danger-soft)}'
    ]
  },
  {
    id: 'pagination',
    name: 'Pagination',
    description: 'Previous, numbered pages with ellipsis, next; collapses to a page count on phones.',
    category: 'component',
    tags: ['pagination', 'navigation'],
    mods: ['px'],
    markup: `<nav class="fl-pagination" aria-label="Pagination">
  <a class="step" href="#" aria-label="Previous page">${px('chevron', 'fl-px prev')}<span>Previous</span></a>
  <ol>
    <li><a href="#">1</a></li>
    <li><a href="#">2</a></li>
    <li><a href="#" aria-current="page">3</a></li>
    <li><a href="#">4</a></li>
    <li class="gap" aria-hidden="true">…</li>
    <li><a href="#">12</a></li>
  </ol>
  <span class="count">Page 3 of 12</span>
  <a class="step" href="#" aria-label="Next page"><span>Next</span>${px('chevron', 'fl-px next')}</a>
</nav>`,
    css: [
      '.fl-pagination{display:flex;align-items:center;justify-content:center;gap:var(--feega-space-2);padding:var(--feega-space-6) var(--feega-gutter);font-size:var(--feega-text-sm);font-weight:500}',
      '.fl-pagination ol{display:flex;gap:4px;margin:0;padding:0;list-style:none}',
      '.fl-pagination ol a,.fl-pagination .gap{display:grid;place-items:center;min-width:36px;height:36px;padding:0 6px;border-radius:var(--feega-radius-full);font-variant-numeric:tabular-nums;transition:background-color var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-pagination ol a:hover{background:var(--feega-surface)}',
      '.fl-pagination ol a[aria-current="page"]{background:var(--feega-fg);color:var(--feega-bg)}',
      '.fl-pagination .gap{color:var(--feega-fg-subtle)}',
      '.fl-pagination .step{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 14px;border-radius:var(--feega-radius-full);box-shadow:inset 0 0 0 1px var(--feega-line-strong);transition:background-color var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-pagination .step:hover{background:var(--feega-surface)}',
      '.fl-pagination .step .fl-px{width:8px}',
      '.fl-pagination .prev{transform:rotate(90deg)}',
      '.fl-pagination .next{transform:rotate(-90deg)}',
      '.fl-pagination .count{display:none;color:var(--feega-fg-muted)}',
      '@media (max-width:560px){.fl-pagination{justify-content:space-between}.fl-pagination ol{display:none}.fl-pagination .count{display:block}}'
    ]
  },
  {
    id: 'breadcrumbs',
    name: 'Breadcrumbs',
    description: 'Trail of links ending at the current page; middle items hide on phones.',
    category: 'component',
    tags: ['breadcrumbs', 'navigation'],
    mods: ['px'],
    markup: `<nav class="fl-breadcrumbs" aria-label="Breadcrumb">
  <ol>
    <li><a href="#">${px('home')}<span class="sr">Home</span></a></li>
    <li class="mid"><a href="#">Workspace</a></li>
    <li class="mid"><a href="#">Projects</a></li>
    <li><a href="#">Website</a></li>
    <li><span aria-current="page">Pricing page</span></li>
  </ol>
</nav>`,
    css: [
      pad('fl-breadcrumbs'),
      '.fl-breadcrumbs ol{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0;padding:0;list-style:none;font-size:var(--feega-text-sm);font-weight:500}',
      '.fl-breadcrumbs li{display:inline-flex;align-items:center;gap:6px;min-width:0}',
      '.fl-breadcrumbs li + li::before{content:"/";color:var(--feega-fg-subtle)}',
      '.fl-breadcrumbs a{display:inline-flex;align-items:center;padding:4px 6px;border-radius:var(--feega-radius-sm);color:var(--feega-fg-muted);transition:background-color var(--feega-dur-fast) var(--feega-ease),color var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-breadcrumbs a:hover{background:var(--feega-surface);color:var(--feega-fg)}',
      '.fl-breadcrumbs .fl-px{width:12px}',
      '.fl-breadcrumbs [aria-current]{overflow:hidden;padding:4px 6px;text-overflow:ellipsis;white-space:nowrap}',
      '.fl-breadcrumbs .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}',
      '@media (max-width:480px){.fl-breadcrumbs .mid{display:none}}'
    ]
  },
  {
    id: 'avatar-group',
    name: 'Avatar group',
    description: 'Overlapping avatars with a remaining count, in three sizes; placeholder initials.',
    category: 'component',
    tags: ['avatar', 'people'],
    mods: ['avatar'],
    markup: `<div class="fl-avatar-group">
${['sm', 'md', 'lg'].map((s) => `  <div class="stack stack--${s}" aria-label="6 people">
    <span class="fl-avatar">NS</span><span class="fl-avatar">FL</span><span class="fl-avatar">AE</span><span class="fl-avatar">SP</span><span class="fl-avatar more">+2</span>
  </div>`).join('\n')}
</div>`,
    css: [
      '.fl-avatar-group{display:flex;flex-wrap:wrap;align-items:center;gap:var(--feega-space-8);padding:var(--feega-space-6) var(--feega-gutter)}',
      '.fl-avatar-group .stack{display:flex}',
      '.fl-avatar-group .fl-avatar{margin-left:-8px;box-shadow:0 0 0 2px var(--feega-bg);transition:transform var(--feega-dur) var(--feega-ease)}',
      '.fl-avatar-group .fl-avatar:first-child{margin-left:0}',
      '.fl-avatar-group .fl-avatar:hover{transform:translateY(-3px)}',
      '.fl-avatar-group .fl-avatar:nth-child(1){background:var(--feega-accent-soft);color:var(--feega-accent-text)}',
      '.fl-avatar-group .fl-avatar:nth-child(2){background:var(--feega-success-soft);color:var(--feega-success)}',
      '.fl-avatar-group .fl-avatar:nth-child(3){background:var(--feega-fg);color:var(--feega-bg)}',
      '.fl-avatar-group .more{background:var(--feega-raised);box-shadow:0 0 0 2px var(--feega-bg),inset 0 0 0 1px var(--feega-line-strong)}',
      '.fl-avatar-group .stack--sm .fl-avatar{width:24px;height:24px;font-size:9px}',
      '.fl-avatar-group .stack--lg .fl-avatar{width:44px;height:44px;margin-left:-12px;font-size:var(--feega-text-sm)}',
      '.fl-avatar-group .stack--lg .fl-avatar:first-child{margin-left:0}'
    ]
  },
  {
    id: 'badge-set',
    name: 'Badge set',
    description: 'Status, count, outline and removable tag badges in every tone.',
    category: 'component',
    tags: ['badge', 'status', 'tag'],
    mods: ['px', 'badge'],
    markup: `<div class="fl-badge-set">
  <div class="row"><span class="fl-badge">Draft</span><span class="fl-badge fl-badge--accent">In review</span><span class="fl-badge fl-badge--success">Live</span><span class="fl-badge fl-badge--danger">Failed</span></div>
  <div class="row"><span class="solid">New</span><span class="count">12</span><span class="count count--accent">3</span><span class="outline">v2.0</span><span class="mono">beta</span></div>
  <div class="row"><span class="tag">design<button type="button" aria-label="Remove design">${px('close')}</button></span><span class="tag">frontend<button type="button" aria-label="Remove frontend">${px('close')}</button></span></div>
</div>`,
    css: [
      '.fl-badge-set{display:grid;gap:var(--feega-space-4);padding:var(--feega-space-6) var(--feega-gutter)}',
      '.fl-badge-set .row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--feega-space-2)}',
      '.fl-badge-set .solid,.fl-badge-set .count,.fl-badge-set .outline,.fl-badge-set .mono,.fl-badge-set .tag{display:inline-flex;align-items:center;gap:6px;min-height:24px;padding:0 10px;border-radius:var(--feega-radius-full);font-size:var(--feega-text-xs);font-weight:500;letter-spacing:0}',
      '.fl-badge-set .solid{background:var(--feega-accent);color:var(--feega-accent-fg)}',
      '.fl-badge-set .count{justify-content:center;min-width:24px;padding:0 7px;background:var(--feega-fg);color:var(--feega-bg);font-variant-numeric:tabular-nums}',
      '.fl-badge-set .count--accent{background:var(--feega-accent);color:var(--feega-accent-fg)}',
      '.fl-badge-set .outline{box-shadow:inset 0 0 0 1px var(--feega-line-strong);color:var(--feega-fg-muted)}',
      '.fl-badge-set .mono{border-radius:var(--feega-radius-xs);background:var(--feega-surface);font-family:var(--feega-font-mono);text-transform:uppercase}',
      '.fl-badge-set .tag{padding-right:4px;background:var(--feega-surface);font-size:var(--feega-text-sm)}',
      '.fl-badge-set .tag button{display:grid;place-items:center;width:18px;height:18px;padding:0;border:0;border-radius:var(--feega-radius-full);background:transparent;color:var(--feega-fg-subtle);cursor:pointer}',
      '.fl-badge-set .tag button:hover{background:var(--feega-line);color:var(--feega-fg)}',
      '.fl-badge-set .tag .fl-px{width:7px}'
    ]
  },
  {
    id: 'form-inputs',
    name: 'Form inputs',
    description: 'Text input, select, checkbox, radio, switch and textarea with labels, hints and an error state.',
    category: 'component',
    tags: ['form', 'input', 'controls'],
    mods: ['field', 'check', 'switch'],
    markup: `<form class="fl-form-inputs" action="#">
  <label class="fl-field" for="fl-inputs-name">Project name<input class="fl-input" id="fl-inputs-name" type="text" placeholder="My website" /><small>Shown in the sidebar.</small></label>
  <label class="fl-field bad" for="fl-inputs-url">Domain<input class="fl-input" id="fl-inputs-url" type="text" value="example" aria-invalid="true" aria-describedby="fl-inputs-url-error" /><small id="fl-inputs-url-error">Enter a full domain, like example.com.</small></label>
  <label class="fl-field" for="fl-inputs-plan">Plan<select class="fl-input" id="fl-inputs-plan"><option>Starter</option><option>Pro</option><option>Business</option></select></label>
  <label class="fl-field" for="fl-inputs-notes">Notes<textarea class="fl-input" id="fl-inputs-notes" rows="3" placeholder="Anything we should know"></textarea></label>
  <fieldset><legend>Visibility</legend>
    <label class="radio"><input type="radio" name="fl-inputs-visibility" checked />Private</label>
    <label class="radio"><input type="radio" name="fl-inputs-visibility" />Team</label>
    <label class="radio"><input type="radio" name="fl-inputs-visibility" />Public</label>
  </fieldset>
  <fieldset><legend>Options</legend>
    <label class="fl-check"><input type="checkbox" checked />Send me updates</label>
    <label class="toggle"><input class="fl-switch" type="checkbox" checked />Auto publish</label>
  </fieldset>
</form>`,
    css: [
      '.fl-form-inputs{display:grid;align-items:start;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--feega-space-6);padding:var(--feega-space-8) var(--feega-gutter)}',
      '.fl-form-inputs small{color:var(--feega-fg-subtle);font-size:var(--feega-text-xs);font-weight:400}',
      '.fl-form-inputs .bad .fl-input{border-color:var(--feega-danger)}',
      '.fl-form-inputs .bad .fl-input:focus{box-shadow:0 0 0 4px var(--feega-danger-soft)}',
      '.fl-form-inputs .bad small{color:var(--feega-danger)}',
      '.fl-form-inputs select.fl-input{height:44px;appearance:auto}',
      '.fl-form-inputs textarea.fl-input{padding-block:12px;resize:vertical}',
      '.fl-form-inputs fieldset{display:grid;align-content:start;gap:var(--feega-space-3);margin:0;padding:0;border:0}',
      '.fl-form-inputs legend{margin-bottom:var(--feega-space-3);padding:0;font-size:var(--feega-text-sm);font-weight:500}',
      '.fl-form-inputs .radio,.fl-form-inputs .toggle{display:inline-flex;align-items:center;gap:var(--feega-space-3);font-size:var(--feega-text-sm);cursor:pointer}',
      '.fl-form-inputs .radio input{appearance:none;display:grid;place-items:center;width:18px;height:18px;margin:0;border:1px solid var(--feega-line-strong);border-radius:var(--feega-radius-full);background:var(--feega-input);cursor:pointer;transition:border-color var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-form-inputs .radio input::after{content:"";width:8px;height:8px;border-radius:var(--feega-radius-full);background:var(--feega-accent);transform:scale(0);transition:transform var(--feega-dur) var(--feega-ease)}',
      '.fl-form-inputs .radio input:checked{border-color:var(--feega-accent)}',
      '.fl-form-inputs .radio input:checked::after{transform:scale(1)}',
      '@media (max-width:640px){.fl-form-inputs{grid-template-columns:minmax(0,1fr)}}'
    ]
  },
  {
    id: 'progress-skeleton',
    name: 'Progress and skeleton',
    description: 'Labelled progress bars, a spinner and a shimmering skeleton card for loading states.',
    category: 'component',
    tags: ['progress', 'loading', 'skeleton'],
    mods: [],
    markup: `<div class="fl-progress-skeleton">
  <div class="bars">
    <label>Uploading <span>64%</span><progress max="100" value="64">64%</progress></label>
    <label>Storage used <span>8.2 of 10 GB</span><progress class="warn" max="100" value="82">82%</progress></label>
    <p class="spin" role="status"><i aria-hidden="true"></i>Building preview…</p>
  </div>
  <div class="skel" aria-busy="true" aria-label="Loading">
    <span class="b img"></span>
    <span class="b line w70"></span>
    <span class="b line"></span>
    <span class="b line w40"></span>
  </div>
</div>`,
    css: [
      '.fl-progress-skeleton{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:var(--feega-space-8);padding:var(--feega-space-8) var(--feega-gutter)}',
      '.fl-progress-skeleton .bars{display:grid;gap:var(--feega-space-6)}',
      '.fl-progress-skeleton label{display:grid;grid-template-columns:1fr auto;gap:var(--feega-space-2);font-size:var(--feega-text-sm);font-weight:500}',
      '.fl-progress-skeleton label span{color:var(--feega-fg-muted);font-variant-numeric:tabular-nums}',
      '.fl-progress-skeleton progress{grid-column:1/-1;width:100%;height:8px;border:0;border-radius:var(--feega-radius-full);background:var(--feega-surface);overflow:hidden;appearance:none}',
      '.fl-progress-skeleton progress::-webkit-progress-bar{background:var(--feega-surface)}',
      '.fl-progress-skeleton progress::-webkit-progress-value{border-radius:var(--feega-radius-full);background:var(--feega-accent);transition:width var(--feega-dur) var(--feega-ease)}',
      '.fl-progress-skeleton progress::-moz-progress-bar{border-radius:var(--feega-radius-full);background:var(--feega-accent)}',
      '.fl-progress-skeleton .warn::-webkit-progress-value{background:var(--feega-danger)}',
      '.fl-progress-skeleton .warn::-moz-progress-bar{background:var(--feega-danger)}',
      '.fl-progress-skeleton .spin{display:inline-flex;align-items:center;gap:var(--feega-space-3);color:var(--feega-fg-muted);font-size:var(--feega-text-sm)}',
      '.fl-progress-skeleton .spin i{width:16px;height:16px;border:2px solid var(--feega-line-strong);border-top-color:var(--feega-accent);border-radius:var(--feega-radius-full);animation:fl-progress-skeleton-spin 800ms linear infinite}',
      '@keyframes fl-progress-skeleton-spin{to{transform:rotate(360deg)}}',
      '.fl-progress-skeleton .skel{display:grid;gap:var(--feega-space-3);padding:var(--feega-space-4);border-radius:var(--feega-radius-lg);background:var(--feega-raised);box-shadow:inset 0 0 0 1px var(--feega-line)}',
      '.fl-progress-skeleton .b{display:block;height:12px;border-radius:var(--feega-radius-xs);background:linear-gradient(90deg,var(--feega-surface) 30%,var(--feega-line) 50%,var(--feega-surface) 70%) 0 0/300% 100%;animation:fl-progress-skeleton-shine 1.4s var(--feega-ease) infinite}',
      '@keyframes fl-progress-skeleton-shine{from{background-position:100% 0}to{background-position:0 0}}',
      '.fl-progress-skeleton .img{height:auto;aspect-ratio:16/9;margin-bottom:var(--feega-space-2);border-radius:var(--feega-radius-md)}',
      '.fl-progress-skeleton .w70{width:70%}',
      '.fl-progress-skeleton .w40{width:40%}',
      '@media (max-width:640px){.fl-progress-skeleton{grid-template-columns:minmax(0,1fr)}}'
    ]
  },
  {
    id: 'notification-list',
    name: 'Notification list',
    description: 'Inbox-style list with unread dots, actor, action, time and a mark-all link.',
    category: 'app',
    tags: ['notifications', 'list', 'inbox'],
    mods: ['px', 'avatar'],
    markup: `<section class="fl-notification-list" aria-label="Notifications">
  <header><h2>Notifications <span>3</span></h2><a href="#">Mark all as read</a></header>
  <ul>
${[[true, 'NS', 'Name Surname', 'commented on', 'Pricing page', '2m'], [true, 'FL', 'First Last', 'published', 'Home', '1h'], [true, null, 'Build', 'failed on', 'Blog index', '3h'], [false, 'AE', 'Alex Example', 'invited you to', 'Website', 'Yesterday']].map(([u, i, who, act, obj, t]) => `    <li${u ? ' class="unread"' : ''}><a href="#">${i ? `<span class="fl-avatar" aria-hidden="true">${i}</span>` : `<span class="fl-avatar sys" aria-hidden="true">${px('warn')}</span>`}<span class="text"><b>${who}</b> ${act} <b>${obj}</b></span><time>${t}</time></a></li>`).join('\n')}
  </ul>
</section>`,
    css: [
      '.fl-notification-list{max-width:30rem;margin:var(--feega-space-6) var(--feega-gutter);overflow:hidden;border-radius:var(--feega-radius-lg);background:var(--feega-raised);box-shadow:var(--feega-shadow-float),inset 0 0 0 1px var(--feega-line)}',
      '.fl-notification-list header{display:flex;justify-content:space-between;align-items:center;gap:var(--feega-space-3);padding:var(--feega-space-4) var(--feega-space-4) var(--feega-space-3)}',
      '.fl-notification-list h2{display:inline-flex;align-items:center;gap:8px;font-size:1rem;font-weight:600;letter-spacing:-0.02em}',
      '.fl-notification-list h2 span{padding:0 7px;border-radius:var(--feega-radius-full);background:var(--feega-accent);color:var(--feega-accent-fg);font-size:11px;line-height:18px}',
      '.fl-notification-list header a{color:var(--feega-fg-muted);font-size:var(--feega-text-sm)}',
      '.fl-notification-list header a:hover{color:var(--feega-fg)}',
      '.fl-notification-list ul{margin:0;padding:0 6px 6px;list-style:none}',
      '.fl-notification-list li a{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:var(--feega-space-3);padding:12px 12px 12px 22px;border-radius:var(--feega-radius-md);font-size:var(--feega-text-sm);transition:background-color var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-notification-list li a:hover{background:var(--feega-surface)}',
      '.fl-notification-list .unread a::before{content:"";position:absolute;top:24px;left:8px;width:6px;height:6px;border-radius:var(--feega-radius-full);background:var(--feega-accent)}',
      '.fl-notification-list .text{color:var(--feega-fg-muted);line-height:1.4}',
      '.fl-notification-list .text b{color:var(--feega-fg);font-weight:500}',
      '.fl-notification-list li:not(.unread) .text{opacity:0.75}',
      '.fl-notification-list .sys{background:var(--feega-danger-soft);color:var(--feega-danger)}',
      '.fl-notification-list .sys .fl-px{width:12px}',
      '.fl-notification-list time{color:var(--feega-fg-subtle);font-size:var(--feega-text-xs);white-space:nowrap}'
    ]
  }
];
