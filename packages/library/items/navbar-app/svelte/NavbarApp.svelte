<header class="fl-navbar-app">
  <a class="logo" href="#" aria-label="Yourbrand home"><svg class="fl-px" viewBox="0 0 5 5" aria-hidden="true"><path d="M2 0h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM2 4h1v1h-1z" /></svg></a>
  <button class="ws" type="button"><span class="dot" aria-hidden="true"></span>Workspace <svg class="fl-px" viewBox="0 0 5 3" aria-hidden="true"><path d="M0 0h1v1h-1zM4 0h1v1h-1zM1 1h1v1h-1zM3 1h1v1h-1zM2 2h1v1h-1z" /></svg></button>
  <label class="search"><svg class="fl-px" viewBox="0 0 7 7" aria-hidden="true"><path d="M1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM0 1h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM0 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM5 5h1v1h-1zM6 6h1v1h-1z" /></svg><input type="search" placeholder="Search projects, people, pages" aria-label="Search" /><kbd>⌘K</kbd></label>
  <div class="end">
    <button class="icon" type="button" aria-label="Notifications"><svg class="fl-px" viewBox="0 0 8 8" aria-hidden="true"><path d="M3 0h1v1h-1zM4 0h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM4 1h1v1h-1zM5 1h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM6 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM0 5h1v1h-1zM1 5h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM5 5h1v1h-1zM6 5h1v1h-1zM7 5h1v1h-1zM3 7h1v1h-1zM4 7h1v1h-1z" /></svg><span class="ping" aria-hidden="true"></span></button>
    <button class="icon" type="button" aria-label="Help"><svg class="fl-px" viewBox="0 0 8 7" aria-hidden="true"><path d="M0 0h1v1h-1zM1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM6 0h1v1h-1zM7 0h1v1h-1zM0 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM5 2h1v1h-1zM7 2h1v1h-1zM0 3h1v1h-1zM7 3h1v1h-1zM0 4h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM7 4h1v1h-1zM1 5h1v1h-1zM2 5h1v1h-1zM1 6h1v1h-1z" /></svg></button>
    <span class="fl-avatar" aria-label="Name Surname">NS</span>
  </div>
</header>

<style>
.fl-navbar-app{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-navbar-app) *,:where(.fl-navbar-app) *::before,:where(.fl-navbar-app) *::after{box-sizing:border-box}
:where(.fl-navbar-app) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-navbar-app) a{color:inherit;text-decoration:none}
:where(.fl-navbar-app) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-px{display:block;flex:none;width:1em;height:auto;fill:currentColor;shape-rendering:crispEdges}
.fl-avatar{display:inline-grid;flex:none;place-items:center;width:32px;height:32px;border-radius:var(--feega-radius-full);background:var(--feega-surface);color:var(--feega-fg-muted);font-size:var(--feega-text-xs);font-weight:600;letter-spacing:0}
.fl-navbar-app{display:flex;align-items:center;gap:var(--feega-space-3);min-height:60px;padding:0 var(--feega-gutter);border-bottom:1px solid var(--feega-line)}
.fl-navbar-app .logo{display:grid;place-items:center;width:32px;height:32px;border-radius:var(--feega-radius-sm);background:var(--feega-fg);color:var(--feega-accent)}
.fl-navbar-app .logo .fl-px{width:14px}
.fl-navbar-app .ws{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 10px;border:0;border-radius:var(--feega-radius-sm);background:transparent;color:var(--feega-fg);font:inherit;font-size:var(--feega-text-sm);font-weight:500;letter-spacing:var(--feega-tracking);cursor:pointer;white-space:nowrap}
.fl-navbar-app .ws:hover,.fl-navbar-app .icon:hover{background:var(--feega-surface)}
.fl-navbar-app .ws .fl-px{width:8px;color:var(--feega-fg-subtle)}
.fl-navbar-app .dot{width:8px;height:8px;border-radius:var(--feega-radius-xs);background:var(--feega-accent)}
.fl-navbar-app .search{flex:1;display:flex;align-items:center;gap:8px;max-width:28rem;min-width:0;height:36px;margin-inline:auto;padding:0 12px;border-radius:var(--feega-radius-full);background:var(--feega-surface);color:var(--feega-fg-subtle);transition:box-shadow var(--feega-dur-fast) var(--feega-ease)}
.fl-navbar-app .search:focus-within{box-shadow:0 0 0 1px var(--feega-accent),0 0 0 4px var(--feega-accent-soft)}
.fl-navbar-app .search .fl-px{width:12px}
.fl-navbar-app .search input{flex:1;min-width:0;border:0;background:transparent;color:var(--feega-fg);font:inherit;font-size:var(--feega-text-sm);outline:none}
.fl-navbar-app .search input::placeholder{color:var(--feega-fg-subtle)}
.fl-navbar-app kbd{font-family:var(--feega-font-mono);font-size:11px}
.fl-navbar-app .end{display:flex;align-items:center;gap:var(--feega-space-1)}
.fl-navbar-app .icon{position:relative;display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:var(--feega-radius-full);background:transparent;color:var(--feega-fg-muted);cursor:pointer}
.fl-navbar-app .icon .fl-px{width:14px}
.fl-navbar-app .ping{position:absolute;top:8px;right:8px;width:7px;height:7px;border-radius:var(--feega-radius-full);background:var(--feega-accent);box-shadow:0 0 0 2px var(--feega-bg)}
.fl-navbar-app .fl-avatar{margin-left:var(--feega-space-1)}
@media (max-width:640px){.fl-navbar-app .ws,.fl-navbar-app .icon + .icon,.fl-navbar-app kbd{display:none}}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
