<section class="fl-notification-list" aria-label="Notifications">
  <header><h2>Notifications <span>3</span></h2><a href="#">Mark all as read</a></header>
  <ul>
    <li class="unread"><a href="#"><span class="fl-avatar" aria-hidden="true">NS</span><span class="text"><b>Name Surname</b> commented on <b>Pricing page</b></span><time>2m</time></a></li>
    <li class="unread"><a href="#"><span class="fl-avatar" aria-hidden="true">FL</span><span class="text"><b>First Last</b> published <b>Home</b></span><time>1h</time></a></li>
    <li class="unread"><a href="#"><span class="fl-avatar sys" aria-hidden="true"><svg class="fl-px" viewBox="0 0 9 8" aria-hidden="true"><path d="M4 0h1v1h-1zM3 1h1v1h-1zM4 1h1v1h-1zM5 1h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM5 3h1v1h-1zM6 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM7 4h1v1h-1zM1 5h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM5 5h1v1h-1zM6 5h1v1h-1zM7 5h1v1h-1zM0 6h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM3 6h1v1h-1zM5 6h1v1h-1zM6 6h1v1h-1zM7 6h1v1h-1zM8 6h1v1h-1zM0 7h1v1h-1zM1 7h1v1h-1zM2 7h1v1h-1zM3 7h1v1h-1zM4 7h1v1h-1zM5 7h1v1h-1zM6 7h1v1h-1zM7 7h1v1h-1zM8 7h1v1h-1z" /></svg></span><span class="text"><b>Build</b> failed on <b>Blog index</b></span><time>3h</time></a></li>
    <li><a href="#"><span class="fl-avatar" aria-hidden="true">AE</span><span class="text"><b>Alex Example</b> invited you to <b>Website</b></span><time>Yesterday</time></a></li>
  </ul>
</section>

<style>
.fl-notification-list{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-notification-list) *,:where(.fl-notification-list) *::before,:where(.fl-notification-list) *::after{box-sizing:border-box}
:where(.fl-notification-list) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-notification-list) a{color:inherit;text-decoration:none}
:where(.fl-notification-list) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-px{display:block;flex:none;width:1em;height:auto;fill:currentColor;shape-rendering:crispEdges}
.fl-avatar{display:inline-grid;flex:none;place-items:center;width:32px;height:32px;border-radius:var(--feega-radius-full);background:var(--feega-surface);color:var(--feega-fg-muted);font-size:var(--feega-text-xs);font-weight:600;letter-spacing:0}
.fl-notification-list{max-width:30rem;margin:var(--feega-space-6) var(--feega-gutter);overflow:hidden;border-radius:var(--feega-radius-lg);background:var(--feega-raised);box-shadow:var(--feega-shadow-float),inset 0 0 0 1px var(--feega-line)}
.fl-notification-list header{display:flex;justify-content:space-between;align-items:center;gap:var(--feega-space-3);padding:var(--feega-space-4) var(--feega-space-4) var(--feega-space-3)}
.fl-notification-list h2{display:inline-flex;align-items:center;gap:8px;font-size:1rem;font-weight:600;letter-spacing:-0.02em}
.fl-notification-list h2 span{padding:0 7px;border-radius:var(--feega-radius-full);background:var(--feega-accent);color:var(--feega-accent-fg);font-size:11px;line-height:18px}
.fl-notification-list header a{color:var(--feega-fg-muted);font-size:var(--feega-text-sm)}
.fl-notification-list header a:hover{color:var(--feega-fg)}
.fl-notification-list ul{margin:0;padding:0 6px 6px;list-style:none}
.fl-notification-list li a{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:var(--feega-space-3);padding:12px 12px 12px 22px;border-radius:var(--feega-radius-md);font-size:var(--feega-text-sm);transition:background-color var(--feega-dur-fast) var(--feega-ease)}
.fl-notification-list li a:hover{background:var(--feega-surface)}
.fl-notification-list .unread a::before{content:"";position:absolute;top:24px;left:8px;width:6px;height:6px;border-radius:var(--feega-radius-full);background:var(--feega-accent)}
.fl-notification-list .text{color:var(--feega-fg-muted);line-height:1.4}
.fl-notification-list .text b{color:var(--feega-fg);font-weight:500}
.fl-notification-list li:not(.unread) .text{opacity:0.75}
.fl-notification-list .sys{background:var(--feega-danger-soft);color:var(--feega-danger)}
.fl-notification-list .sys .fl-px{width:12px}
.fl-notification-list time{color:var(--feega-fg-subtle);font-size:var(--feega-text-xs);white-space:nowrap}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
