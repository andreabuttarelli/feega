<header class="fl-top-bar">
  <div class="left">
    <a class="mark" href="#" aria-label="Home"><svg class="fl-px" viewBox="0 0 5 5" aria-hidden="true"><path d="M2 0h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM2 4h1v1h-1z" /></svg></a>
    <nav aria-label="Breadcrumb">
      <ol>
        <li><a href="#">Workspace</a></li>
        <li><a href="#">Website</a></li>
        <li><span aria-current="page">Home page</span></li>
      </ol>
    </nav>
  </div>
  <label class="search"><svg class="fl-px" viewBox="0 0 7 7" aria-hidden="true"><path d="M1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM0 1h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM0 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM5 5h1v1h-1zM6 6h1v1h-1z" /></svg><input type="search" placeholder="Search or jump to" aria-label="Search" /><kbd>⌘K</kbd></label>
  <div class="right">
    <button class="icon" type="button" aria-label="Notifications"><svg class="fl-px" viewBox="0 0 8 8" aria-hidden="true"><path d="M3 0h1v1h-1zM4 0h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM4 1h1v1h-1zM5 1h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM6 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM0 5h1v1h-1zM1 5h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM5 5h1v1h-1zM6 5h1v1h-1zM7 5h1v1h-1zM3 7h1v1h-1zM4 7h1v1h-1z" /></svg><span class="dot"></span></button>
    <span class="fl-avatar" aria-label="Name Surname">NS</span>
    <button class="share" type="button">Share</button>
  </div>
</header>

<style>
.fl-top-bar{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-top-bar) *,:where(.fl-top-bar) *::before,:where(.fl-top-bar) *::after{box-sizing:border-box}
:where(.fl-top-bar) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-top-bar) a{color:inherit;text-decoration:none}
:where(.fl-top-bar) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-px{display:block;flex:none;width:1em;height:auto;fill:currentColor;shape-rendering:crispEdges}
.fl-avatar{display:inline-grid;flex:none;place-items:center;width:32px;height:32px;border-radius:var(--feega-radius-full);background:var(--feega-surface);color:var(--feega-fg-muted);font-size:var(--feega-text-xs);font-weight:600;letter-spacing:0}
.fl-top-bar{display:flex;align-items:center;gap:var(--feega-space-4);height:56px;padding:0 var(--feega-space-3);border-bottom:1px solid var(--feega-line)}
.fl-top-bar .left{display:flex;flex:1;align-items:center;gap:var(--feega-space-2);min-width:0}
.fl-top-bar .mark{display:grid;place-items:center;width:36px;height:36px;border-radius:var(--feega-radius-sm);color:var(--feega-accent);transition:background-color var(--feega-dur-fast) var(--feega-ease)}
.fl-top-bar .mark:hover{background:var(--feega-surface)}
.fl-top-bar .mark .fl-px{width:16px}
.fl-top-bar ol{display:flex;align-items:center;margin:0;padding:0;list-style:none;font-size:var(--feega-text-sm);white-space:nowrap}
.fl-top-bar li{display:flex;align-items:center;min-width:0}
.fl-top-bar li + li::before{content:"/";padding:0 8px;color:var(--feega-line-strong)}
.fl-top-bar li a{color:var(--feega-fg-muted)}
.fl-top-bar li a:hover{color:var(--feega-fg)}
.fl-top-bar li span{overflow:hidden;font-weight:500;text-overflow:ellipsis}
.fl-top-bar .search{display:flex;flex:0 1 320px;align-items:center;gap:8px;height:36px;padding:0 12px;border-radius:var(--feega-radius-full);background:var(--feega-surface);color:var(--feega-fg-subtle);transition:box-shadow var(--feega-dur-fast) var(--feega-ease)}
.fl-top-bar .search:focus-within{box-shadow:inset 0 0 0 1px var(--feega-accent),0 0 0 3px var(--feega-accent-soft)}
.fl-top-bar .search .fl-px{width:12px}
.fl-top-bar .search input{flex:1;min-width:0;border:0;background:transparent;color:var(--feega-fg);font:inherit;font-size:var(--feega-text-sm);outline:none}
.fl-top-bar kbd{font-family:var(--feega-font-mono);font-size:11px}
.fl-top-bar .right{display:flex;flex:1;align-items:center;justify-content:flex-end;gap:var(--feega-space-2)}
.fl-top-bar .icon{position:relative;display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:var(--feega-radius-full);background:transparent;color:var(--feega-fg-muted);cursor:pointer;transition:background-color var(--feega-dur-fast) var(--feega-ease)}
.fl-top-bar .icon:hover{background:var(--feega-surface);color:var(--feega-fg)}
.fl-top-bar .icon .fl-px{width:14px}
.fl-top-bar .dot{position:absolute;top:8px;right:9px;width:7px;height:7px;border-radius:var(--feega-radius-full);background:var(--feega-accent);box-shadow:0 0 0 2px var(--feega-bg)}
.fl-top-bar .share{height:32px;padding:0 14px;border:0;border-radius:var(--feega-radius-full);background:var(--feega-accent);color:var(--feega-accent-fg);font:inherit;font-size:var(--feega-text-sm);font-weight:500;cursor:pointer;transition:background-color var(--feega-dur-fast) var(--feega-ease),transform var(--feega-dur-fast) var(--feega-ease)}
.fl-top-bar .share:hover{background:var(--feega-accent-hover)}
.fl-top-bar .share:active{transform:scale(0.96)}
@media (max-width:760px){.fl-top-bar .search,.fl-top-bar li:not(:last-child){display:none}}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
