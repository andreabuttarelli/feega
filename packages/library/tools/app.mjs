import { px } from './kit.mjs';

export const app = [
  {
    id: 'sidebar-layout',
    mods: ['px', 'avatar', 'badge'],
    markup: `<div class="fl-sidebar-layout">
  <aside class="side">
    <a class="brand" href="#">${px('mark')}<span>yourbrand</span></a>
    <label class="search">${px('search')}<input type="search" placeholder="Search" aria-label="Search" /><kbd>⌘K</kbd></label>
    <nav aria-label="Main">
      <ul>
        <li><a href="#" aria-current="page">${px('home')}Overview</a></li>
        <li><a href="#">${px('grid')}Projects</a></li>
        <li><a href="#">${px('chat')}Inbox<span class="count">3</span></a></li>
        <li><a href="#">${px('chart')}Analytics</a></li>
        <li><a href="#">${px('gear')}Settings</a></li>
      </ul>
    </nav>
    <div class="me"><span class="fl-avatar" aria-hidden="true">NS</span><span><b>Name Surname</b><small>name@example.com</small></span></div>
  </aside>
  <main class="main">
    <header class="head">
      <h1>overview</h1>
      <a class="new" href="#">${px('plus')}New project</a>
    </header>
    <ul class="stats">
      <li><span>Visitors</span><b>8,204</b><em class="fl-badge fl-badge--success">+12%</em></li>
      <li><span>Signups</span><b>312</b><em class="fl-badge fl-badge--success">+4%</em></li>
      <li><span>Churn</span><b>1.8%</b><em class="fl-badge fl-badge--danger">+0.3%</em></li>
    </ul>
    <div class="slot">Your page content goes here</div>
  </main>
</div>`,
    css: [
      '.fl-sidebar-layout{display:grid;grid-template-columns:248px minmax(0,1fr);min-height:600px;background:var(--feega-surface)}',
      '.fl-sidebar-layout .side{display:flex;flex-direction:column;gap:var(--feega-space-4);padding:var(--feega-space-4) var(--feega-space-3)}',
      '.fl-sidebar-layout .brand{display:inline-flex;align-items:center;gap:10px;padding:6px 10px;font-weight:600;letter-spacing:-0.04em}',
      '.fl-sidebar-layout .brand .fl-px{width:14px;color:var(--feega-accent)}',
      '.fl-sidebar-layout .search{display:flex;align-items:center;gap:8px;height:36px;padding:0 10px;border-radius:var(--feega-radius-sm);background:var(--feega-input);color:var(--feega-fg-subtle);box-shadow:inset 0 0 0 1px var(--feega-line)}',
      '.fl-sidebar-layout .search:focus-within{box-shadow:inset 0 0 0 1px var(--feega-accent),0 0 0 3px var(--feega-accent-soft)}',
      '.fl-sidebar-layout .search .fl-px{width:12px}',
      '.fl-sidebar-layout .search input{flex:1;min-width:0;border:0;background:transparent;color:var(--feega-fg);font:inherit;font-size:var(--feega-text-sm);outline:none}',
      '.fl-sidebar-layout kbd{font-family:var(--feega-font-mono);font-size:11px}',
      '.fl-sidebar-layout nav ul{display:grid;gap:2px;margin:0;padding:0;list-style:none}',
      '.fl-sidebar-layout nav a{display:flex;align-items:center;gap:10px;height:34px;padding:0 10px;border-radius:var(--feega-radius-sm);color:var(--feega-fg-muted);font-size:var(--feega-text-sm);font-weight:500;transition:background-color var(--feega-dur-fast) var(--feega-ease),color var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-sidebar-layout nav a .fl-px{width:13px}',
      '.fl-sidebar-layout nav a:hover{background:var(--feega-line);color:var(--feega-fg)}',
      '.fl-sidebar-layout nav a[aria-current="page"]{background:var(--feega-raised);color:var(--feega-fg);box-shadow:var(--feega-shadow)}',
      '.fl-sidebar-layout nav a[aria-current="page"] .fl-px{color:var(--feega-accent)}',
      '.fl-sidebar-layout .count{margin-left:auto;padding:0 7px;border-radius:var(--feega-radius-full);background:var(--feega-accent);color:var(--feega-accent-fg);font-size:11px;line-height:18px}',
      '.fl-sidebar-layout .me{display:flex;align-items:center;gap:10px;margin-top:auto;padding:8px;border-radius:var(--feega-radius-sm);font-size:var(--feega-text-sm)}',
      '.fl-sidebar-layout .me span:last-child{display:grid;min-width:0;line-height:1.3}',
      '.fl-sidebar-layout .me small{overflow:hidden;color:var(--feega-fg-subtle);text-overflow:ellipsis;white-space:nowrap}',
      '.fl-sidebar-layout .main{display:flex;flex-direction:column;gap:var(--feega-space-8);margin:8px 8px 8px 0;padding:clamp(1.5rem,4vw,3rem);border-radius:var(--feega-radius-md);background:var(--feega-bg);box-shadow:var(--feega-shadow)}',
      '.fl-sidebar-layout .head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:var(--feega-space-4)}',
      '.fl-sidebar-layout h1{font-family:var(--feega-font-display);font-size:clamp(2.5rem,5vw,4rem);font-weight:600;line-height:0.95;letter-spacing:-0.05em}',
      '.fl-sidebar-layout .new{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 14px;border-radius:var(--feega-radius-full);background:var(--feega-fg);color:var(--feega-bg);font-size:var(--feega-text-sm);font-weight:500;transition:transform var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-sidebar-layout .new:active{transform:scale(0.97)}',
      '.fl-sidebar-layout .new .fl-px{width:10px}',
      '.fl-sidebar-layout .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--feega-space-3);margin:0;padding:0;list-style:none}',
      '.fl-sidebar-layout .stats li{display:grid;gap:6px;justify-items:start;padding:var(--feega-space-6);border-radius:var(--feega-radius-md);background:var(--feega-surface)}',
      '.fl-sidebar-layout .stats span{font-size:var(--feega-text-sm);color:var(--feega-fg-muted)}',
      '.fl-sidebar-layout .stats b{font-size:2rem;font-weight:500;line-height:1;letter-spacing:-0.05em}',
      '.fl-sidebar-layout .stats em{font-style:normal}',
      '.fl-sidebar-layout .slot{display:grid;flex:1;place-items:center;min-height:180px;border:1px dashed var(--feega-line-strong);border-radius:var(--feega-radius-md);color:var(--feega-fg-subtle);font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);text-transform:uppercase}',
      '@media (max-width:760px){.fl-sidebar-layout{grid-template-columns:minmax(0,1fr)}.fl-sidebar-layout .side{padding-bottom:0}.fl-sidebar-layout .search,.fl-sidebar-layout .me{display:none}.fl-sidebar-layout nav ul{display:flex;overflow-x:auto}.fl-sidebar-layout nav a{white-space:nowrap}.fl-sidebar-layout .main{margin:8px}.fl-sidebar-layout .stats{grid-template-columns:minmax(0,1fr)}}'
    ]
  },
  {
    id: 'top-bar',
    mods: ['px', 'avatar'],
    markup: `<header class="fl-top-bar">
  <div class="left">
    <a class="mark" href="#" aria-label="Home">${px('mark')}</a>
    <nav aria-label="Breadcrumb">
      <ol>
        <li><a href="#">Workspace</a></li>
        <li><a href="#">Website</a></li>
        <li><span aria-current="page">Home page</span></li>
      </ol>
    </nav>
  </div>
  <label class="search">${px('search')}<input type="search" placeholder="Search or jump to" aria-label="Search" /><kbd>⌘K</kbd></label>
  <div class="right">
    <button class="icon" type="button" aria-label="Notifications">${px('bell')}<span class="dot"></span></button>
    <span class="fl-avatar" aria-label="Name Surname">NS</span>
    <button class="share" type="button">Share</button>
  </div>
</header>`,
    css: [
      '.fl-top-bar{display:flex;align-items:center;gap:var(--feega-space-4);height:56px;padding:0 var(--feega-space-3);border-bottom:1px solid var(--feega-line)}',
      '.fl-top-bar .left{display:flex;flex:1;align-items:center;gap:var(--feega-space-2);min-width:0}',
      '.fl-top-bar .mark{display:grid;place-items:center;width:36px;height:36px;border-radius:var(--feega-radius-sm);color:var(--feega-accent);transition:background-color var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-top-bar .mark:hover{background:var(--feega-surface)}',
      '.fl-top-bar .mark .fl-px{width:16px}',
      '.fl-top-bar ol{display:flex;align-items:center;margin:0;padding:0;list-style:none;font-size:var(--feega-text-sm);white-space:nowrap}',
      '.fl-top-bar li{display:flex;align-items:center;min-width:0}',
      '.fl-top-bar li + li::before{content:"/";padding:0 8px;color:var(--feega-line-strong)}',
      '.fl-top-bar li a{color:var(--feega-fg-muted)}',
      '.fl-top-bar li a:hover{color:var(--feega-fg)}',
      '.fl-top-bar li span{overflow:hidden;font-weight:500;text-overflow:ellipsis}',
      '.fl-top-bar .search{display:flex;flex:0 1 320px;align-items:center;gap:8px;height:36px;padding:0 12px;border-radius:var(--feega-radius-full);background:var(--feega-surface);color:var(--feega-fg-subtle);transition:box-shadow var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-top-bar .search:focus-within{box-shadow:inset 0 0 0 1px var(--feega-accent),0 0 0 3px var(--feega-accent-soft)}',
      '.fl-top-bar .search .fl-px{width:12px}',
      '.fl-top-bar .search input{flex:1;min-width:0;border:0;background:transparent;color:var(--feega-fg);font:inherit;font-size:var(--feega-text-sm);outline:none}',
      '.fl-top-bar kbd{font-family:var(--feega-font-mono);font-size:11px}',
      '.fl-top-bar .right{display:flex;flex:1;align-items:center;justify-content:flex-end;gap:var(--feega-space-2)}',
      '.fl-top-bar .icon{position:relative;display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:var(--feega-radius-full);background:transparent;color:var(--feega-fg-muted);cursor:pointer;transition:background-color var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-top-bar .icon:hover{background:var(--feega-surface);color:var(--feega-fg)}',
      '.fl-top-bar .icon .fl-px{width:14px}',
      '.fl-top-bar .dot{position:absolute;top:8px;right:9px;width:7px;height:7px;border-radius:var(--feega-radius-full);background:var(--feega-accent);box-shadow:0 0 0 2px var(--feega-bg)}',
      '.fl-top-bar .share{height:32px;padding:0 14px;border:0;border-radius:var(--feega-radius-full);background:var(--feega-accent);color:var(--feega-accent-fg);font:inherit;font-size:var(--feega-text-sm);font-weight:500;cursor:pointer;transition:background-color var(--feega-dur-fast) var(--feega-ease),transform var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-top-bar .share:hover{background:var(--feega-accent-hover)}',
      '.fl-top-bar .share:active{transform:scale(0.96)}',
      '@media (max-width:760px){.fl-top-bar .search,.fl-top-bar li:not(:last-child){display:none}}'
    ]
  },
  {
    id: 'login-form',
    mods: ['px', 'btn', 'field', 'check', 'dots'],
    markup: `<section class="fl-login-form fl-dots">
  <form class="card" method="post" action="#">
    <span class="logo">${px('mark')}</span>
    <h1>Log in to Yourbrand</h1>
    <p class="sub">Welcome back. Use your work email.</p>
    <button class="fl-btn sso" type="button">${px('lock')}Continue with SSO</button>
    <p class="or"><span>or</span></p>
    <label class="fl-field">Email<input class="fl-input" type="email" name="email" placeholder="you@example.com" autocomplete="email" required /></label>
    <label class="fl-field"><span class="row">Password<a href="#">Forgot?</a></span><input class="fl-input" type="password" name="password" autocomplete="current-password" required /></label>
    <label class="fl-check"><input type="checkbox" name="remember" />Keep me logged in</label>
    <button class="fl-btn fl-btn--primary" type="submit">Log in</button>
    <p class="alt">No account? <a href="#">Sign up</a></p>
  </form>
</section>`,
    css: [
      '.fl-login-form{display:grid;place-items:center;min-height:640px;padding:var(--feega-space-12) var(--feega-gutter);background-color:var(--feega-surface)}',
      '.fl-login-form .card{display:grid;gap:var(--feega-space-4);width:min(100%,25rem);padding:var(--feega-space-8);border-radius:var(--feega-radius-lg);background:var(--feega-raised);box-shadow:var(--feega-shadow-float);animation:fl-login-form-in var(--feega-dur) var(--feega-ease)}',
      '@keyframes fl-login-form-in{from{opacity:0;transform:translateY(8px)}}',
      '.fl-login-form .logo{display:grid;place-items:center;width:44px;height:44px;margin-bottom:var(--feega-space-2);border-radius:var(--feega-radius-md);background:var(--feega-fg);color:var(--feega-accent)}',
      '.fl-login-form .logo .fl-px{width:18px}',
      '.fl-login-form h1{font-size:1.375rem;font-weight:600;letter-spacing:-0.04em}',
      '.fl-login-form .sub{margin-top:-10px;color:var(--feega-fg-muted);font-size:var(--feega-text-sm)}',
      '.fl-login-form .fl-btn{width:100%}',
      '.fl-login-form .sso .fl-px{width:12px}',
      '.fl-login-form .sso:hover .fl-px{transform:none}',
      '.fl-login-form .or{display:flex;align-items:center;gap:var(--feega-space-3);color:var(--feega-fg-subtle);font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);text-transform:uppercase}',
      '.fl-login-form .or::before,.fl-login-form .or::after{content:"";flex:1;height:1px;background:var(--feega-line)}',
      '.fl-login-form .row{display:flex;justify-content:space-between}',
      '.fl-login-form .row a,.fl-login-form .alt a{color:var(--feega-accent-text);font-weight:500}',
      '.fl-login-form .row a:hover,.fl-login-form .alt a:hover{text-decoration:underline;text-underline-offset:3px}',
      '.fl-login-form .alt{color:var(--feega-fg-muted);font-size:var(--feega-text-sm);text-align:center}'
    ]
  },
  {
    id: 'settings-form',
    mods: ['btn', 'field', 'switch', 'avatar', 'badge'],
    markup: `<section class="fl-settings-form">
  <form method="post" action="#">
    <header class="head">
      <h1>Profile</h1>
      <p>How other people see you across the workspace.</p>
    </header>
    <div class="row">
      <div class="label"><b>Photo</b><span>Square, at least 256 px.</span></div>
      <div class="control photo"><span class="fl-avatar" aria-hidden="true">NS</span><button class="fl-btn fl-btn--sm" type="button">Upload</button><button class="fl-btn fl-btn--sm fl-btn--ghost" type="button">Remove</button></div>
    </div>
    <div class="row">
      <label class="label" for="fl-settings-name"><b>Name</b><span>Your full name.</span></label>
      <div class="control"><input class="fl-input" id="fl-settings-name" name="name" value="Name Surname" autocomplete="name" /></div>
    </div>
    <div class="row">
      <label class="label" for="fl-settings-email"><b>Email</b><span>Used to log in.</span></label>
      <div class="control"><input class="fl-input" id="fl-settings-email" type="email" name="email" value="name@example.com" autocomplete="email" /><span class="fl-badge fl-badge--success">Verified</span></div>
    </div>
    <div class="row">
      <label class="label" for="fl-settings-bio"><b>Bio</b><span>A line or two. Shown on your profile.</span></label>
      <div class="control"><textarea class="fl-input" id="fl-settings-bio" name="bio" rows="3" maxlength="160" placeholder="What you work on"></textarea></div>
    </div>
    <div class="row">
      <div class="label"><b>Email me</b><span>You can change this anytime.</span></div>
      <div class="control toggles">
        <label><input class="fl-switch" type="checkbox" role="switch" name="updates" checked />Product updates</label>
        <label><input class="fl-switch" type="checkbox" role="switch" name="digest" />Weekly digest</label>
      </div>
    </div>
    <footer class="actions">
      <button class="fl-btn fl-btn--sm fl-btn--ghost" type="reset">Cancel</button>
      <button class="fl-btn fl-btn--sm fl-btn--ink" type="submit">Save changes</button>
    </footer>
  </form>
</section>`,
    css: [
      '.fl-settings-form{padding:clamp(1.5rem,5vw,4rem) var(--feega-gutter)}',
      '.fl-settings-form form{max-width:48rem;margin-inline:auto}',
      '.fl-settings-form .head{display:grid;gap:var(--feega-space-2);padding-bottom:var(--feega-space-8)}',
      '.fl-settings-form h1{font-family:var(--feega-font-display);font-size:clamp(2.5rem,5vw,3.5rem);font-weight:600;line-height:0.95;letter-spacing:-0.05em}',
      '.fl-settings-form .head p{color:var(--feega-fg-muted)}',
      '.fl-settings-form .row{display:grid;grid-template-columns:minmax(0,15rem) minmax(0,1fr);gap:var(--feega-space-4) var(--feega-space-8);padding-block:var(--feega-space-6);border-top:1px solid var(--feega-line)}',
      '.fl-settings-form .label{display:grid;align-content:start;gap:2px;font-size:var(--feega-text-sm)}',
      '.fl-settings-form .label b{font-weight:500}',
      '.fl-settings-form .label span{color:var(--feega-fg-muted)}',
      '.fl-settings-form .control{display:flex;flex-wrap:wrap;align-items:center;gap:var(--feega-space-3)}',
      '.fl-settings-form .control .fl-input{flex:1 1 14rem}',
      '.fl-settings-form textarea.fl-input{min-height:96px;padding-block:12px;resize:vertical}',
      '.fl-settings-form .photo .fl-avatar{width:56px;height:56px;font-size:var(--feega-text-sm)}',
      '.fl-settings-form .toggles{display:grid;gap:var(--feega-space-4)}',
      '.fl-settings-form .toggles label{display:flex;align-items:center;gap:var(--feega-space-3);font-size:var(--feega-text-sm);font-weight:500;cursor:pointer}',
      '.fl-settings-form .actions{display:flex;justify-content:flex-end;gap:var(--feega-space-2);padding-top:var(--feega-space-6);border-top:1px solid var(--feega-line)}',
      '@media (max-width:640px){.fl-settings-form .row{grid-template-columns:minmax(0,1fr)}}'
    ]
  },
  {
    id: 'data-table',
    mods: ['px', 'btn', 'avatar', 'badge'],
    markup: `<section class="fl-data-table">
  <header class="head">
    <div><h2>Members</h2><p>24 people in this workspace.</p></div>
    <div class="tools">
      <label class="search">${px('search')}<input type="search" placeholder="Filter members" aria-label="Filter members" /></label>
      <button class="fl-btn fl-btn--sm fl-btn--ink" type="button">${px('plus')}Invite</button>
    </div>
  </header>
  <div class="scroll">
    <table>
      <thead>
        <tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Last active</th><th scope="col"><span class="sr">Actions</span></th></tr>
      </thead>
      <tbody>
        <tr><td><span class="who"><span class="fl-avatar" aria-hidden="true">SE</span><span><b>Sam Example</b><small>sam@example.com</small></span></span></td><td>Owner</td><td><span class="fl-badge fl-badge--success">Active</span></td><td class="mono">2 min ago</td><td><button class="more" type="button" aria-label="Actions for Sam Example">${px('dots')}</button></td></tr>
        <tr><td><span class="who"><span class="fl-avatar" aria-hidden="true">RS</span><span><b>Robin Sample</b><small>robin@example.com</small></span></span></td><td>Admin</td><td><span class="fl-badge fl-badge--success">Active</span></td><td class="mono">1 h ago</td><td><button class="more" type="button" aria-label="Actions for Robin Sample">${px('dots')}</button></td></tr>
        <tr><td><span class="who"><span class="fl-avatar" aria-hidden="true">KP</span><span><b>Kai Placeholder</b><small>kai@example.com</small></span></span></td><td>Editor</td><td><span class="fl-badge">Invited</span></td><td class="mono">never</td><td><button class="more" type="button" aria-label="Actions for Kai Placeholder">${px('dots')}</button></td></tr>
        <tr><td><span class="who"><span class="fl-avatar" aria-hidden="true">AD</span><span><b>Alex Demo</b><small>alex@example.com</small></span></span></td><td>Viewer</td><td><span class="fl-badge fl-badge--danger">Suspended</span></td><td class="mono">12 days ago</td><td><button class="more" type="button" aria-label="Actions for Alex Demo">${px('dots')}</button></td></tr>
      </tbody>
    </table>
  </div>
  <footer class="foot">
    <p>Showing 1–4 of 24</p>
    <div><button class="fl-btn fl-btn--sm" type="button" disabled>Previous</button><button class="fl-btn fl-btn--sm" type="button">Next</button></div>
  </footer>
</section>`,
    css: [
      '.fl-data-table{padding:var(--feega-space-6) var(--feega-gutter)}',
      '.fl-data-table .head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:var(--feega-space-4);margin-bottom:var(--feega-space-6)}',
      '.fl-data-table h2{font-size:var(--feega-text-xl);font-weight:600;letter-spacing:-0.04em}',
      '.fl-data-table .head p{color:var(--feega-fg-muted);font-size:var(--feega-text-sm)}',
      '.fl-data-table .tools{display:flex;gap:var(--feega-space-2)}',
      '.fl-data-table .tools .fl-px{width:10px}',
      '.fl-data-table .tools .fl-btn:hover .fl-px{transform:none}',
      '.fl-data-table .search{display:flex;align-items:center;gap:8px;height:36px;padding:0 12px;border-radius:var(--feega-radius-full);background:var(--feega-surface);color:var(--feega-fg-subtle)}',
      '.fl-data-table .search:focus-within{box-shadow:inset 0 0 0 1px var(--feega-accent),0 0 0 3px var(--feega-accent-soft)}',
      '.fl-data-table .search .fl-px{width:12px}',
      '.fl-data-table .search input{width:10rem;border:0;background:transparent;color:var(--feega-fg);font:inherit;font-size:var(--feega-text-sm);outline:none}',
      '.fl-data-table .scroll{position:relative;overflow-x:auto;border:1px solid var(--feega-line);border-radius:var(--feega-radius-md)}',
      '.fl-data-table table{width:100%;min-width:40rem;border-collapse:collapse;font-size:var(--feega-text-sm)}',
      '.fl-data-table th{padding:10px 16px;background:var(--feega-surface);color:var(--feega-fg-subtle);font-family:var(--feega-font-mono);font-size:11px;font-weight:400;letter-spacing:0.02em;text-align:left;text-transform:uppercase}',
      '.fl-data-table td{padding:12px 16px;border-top:1px solid var(--feega-line);color:var(--feega-fg-muted);transition:background-color var(--feega-dur-fast) var(--feega-ease)}',
      '.fl-data-table tbody tr:hover td{background:var(--feega-surface)}',
      '.fl-data-table .who{display:flex;align-items:center;gap:12px}',
      '.fl-data-table .who > span:last-child{display:grid;line-height:1.3}',
      '.fl-data-table .who b{color:var(--feega-fg);font-weight:500}',
      '.fl-data-table .who small{color:var(--feega-fg-subtle)}',
      '.fl-data-table .mono{font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);letter-spacing:0;white-space:nowrap}',
      '.fl-data-table .more{display:grid;place-items:center;width:32px;height:32px;margin-left:auto;border:0;border-radius:var(--feega-radius-sm);background:transparent;color:var(--feega-fg-subtle);cursor:pointer}',
      '.fl-data-table .more:hover{background:var(--feega-line);color:var(--feega-fg)}',
      '.fl-data-table .more .fl-px{width:14px}',
      '.fl-data-table .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}',
      '.fl-data-table .foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--feega-space-3);margin-top:var(--feega-space-4);color:var(--feega-fg-muted);font-size:var(--feega-text-sm)}',
      '.fl-data-table .foot div{display:flex;gap:var(--feega-space-2)}'
    ]
  },
  {
    id: 'empty-state',
    mods: ['px', 'btn', 'dots'],
    markup: `<section class="fl-empty-state">
  <div class="box fl-dots">
    <div class="art">${px('inbox')}</div>
    <h2>no projects yet</h2>
    <p>Projects keep your pages, assets and people together. Start one from scratch or import what you have.</p>
    <div class="cta">
      <a class="fl-btn fl-btn--primary" href="#">New project</a>
      <a class="fl-btn" href="#">Import</a>
    </div>
  </div>
</section>`,
    css: [
      '.fl-empty-state{padding:var(--feega-space-6) var(--feega-gutter)}',
      '.fl-empty-state .box{display:flex;flex-direction:column;align-items:center;padding:clamp(3rem,8vw,6rem) var(--feega-space-6);border:1px dashed var(--feega-line-strong);border-radius:var(--feega-radius-lg);text-align:center}',
      '.fl-empty-state .art{display:grid;place-items:center;width:96px;height:96px;margin-bottom:var(--feega-space-8);border-radius:var(--feega-radius-lg);background:var(--feega-raised);color:var(--feega-accent);box-shadow:var(--feega-shadow-float);animation:fl-empty-state-float 4s var(--feega-ease) infinite alternate}',
      '.fl-empty-state .art .fl-px{width:44px}',
      '@keyframes fl-empty-state-float{to{transform:translateY(-6px)}}',
      '.fl-empty-state h2{font-family:var(--feega-font-display);font-size:clamp(2rem,4vw,3rem);font-weight:500;line-height:1;letter-spacing:-0.05em}',
      '.fl-empty-state p{max-width:26rem;margin-top:var(--feega-space-4);color:var(--feega-fg-muted)}',
      '.fl-empty-state .cta{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--feega-space-2);margin-top:var(--feega-space-8)}'
    ]
  }
];

export const components = [
  {
    id: 'card',
    mods: ['px', 'avatar', 'dots'],
    markup: `<article class="fl-card">
  <a class="link" href="#">
    <div class="media fl-dots" role="img" aria-label="Placeholder cover">${px('layers')}</div>
    <div class="body">
      <p class="meta"><span>guide</span><span>6 min read</span></p>
      <h3>A clear title that says what the reader gets</h3>
      <p class="excerpt">Two lines of summary. Enough to decide whether to open it, short enough to scan.</p>
      <footer><span class="fl-avatar" aria-hidden="true">NS</span><span>Name Surname</span>${px('arrow')}</footer>
    </div>
  </a>
</article>`,
    css: [
      '.fl-card{padding:var(--feega-space-6) var(--feega-gutter)}',
      '.fl-card .link{display:block;max-width:24rem;overflow:hidden;border-radius:var(--feega-radius-lg);background:var(--feega-raised);box-shadow:var(--feega-shadow),inset 0 0 0 1px var(--feega-line);transition:transform var(--feega-dur) var(--feega-ease),box-shadow var(--feega-dur) var(--feega-ease)}',
      '.fl-card .link:hover{transform:translateY(-4px);box-shadow:var(--feega-shadow-float),inset 0 0 0 1px var(--feega-line)}',
      '.fl-card .media{display:grid;place-items:center;aspect-ratio:16/10;background-color:var(--feega-surface);color:var(--feega-accent)}',
      '.fl-card .media .fl-px{width:72px;transition:transform var(--feega-dur) var(--feega-ease)}',
      '.fl-card .link:hover .media .fl-px{transform:scale(1.12)}',
      '.fl-card .body{display:grid;gap:var(--feega-space-3);padding:var(--feega-space-6)}',
      '.fl-card .meta{display:flex;gap:var(--feega-space-3);color:var(--feega-fg-subtle);font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);letter-spacing:0;text-transform:uppercase}',
      '.fl-card .meta span:first-child{color:var(--feega-accent-text)}',
      '.fl-card h3{font-size:1.375rem;font-weight:500;line-height:1.15;letter-spacing:-0.04em;text-wrap:balance}',
      '.fl-card .excerpt{color:var(--feega-fg-muted);font-size:var(--feega-text-sm)}',
      '.fl-card footer{display:flex;align-items:center;gap:10px;margin-top:var(--feega-space-2);font-size:var(--feega-text-sm);font-weight:500}',
      '.fl-card footer .fl-px{width:10px;margin-left:auto;color:var(--feega-fg-subtle);transition:transform var(--feega-dur) var(--feega-ease),color var(--feega-dur) var(--feega-ease)}',
      '.fl-card .link:hover footer .fl-px{color:var(--feega-accent);transform:translateX(4px)}'
    ]
  }
];
