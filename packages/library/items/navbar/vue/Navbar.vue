<template>
  <header class="fl-navbar">
    <div class="fl-container bar">
      <a class="brand" href="#" aria-label="Yourbrand home"><svg class="fl-px" viewBox="0 0 5 5" aria-hidden="true"><path d="M2 0h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM2 4h1v1h-1z" /></svg><span>yourbrand</span></a>
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
          <summary aria-label="Menu"><svg class="fl-px" viewBox="0 0 6 5" aria-hidden="true"><path d="M0 0h1v1h-1zM1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM0 4h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM5 4h1v1h-1z" /></svg></summary>
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
  </header>
</template>

<style scoped>
.fl-navbar{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-navbar) *,:where(.fl-navbar) *::before,:where(.fl-navbar) *::after{box-sizing:border-box}
:where(.fl-navbar) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-navbar) a{color:inherit;text-decoration:none}
:where(.fl-navbar) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-container{width:min(var(--feega-max-width),100% - 2 * var(--feega-gutter));margin-inline:auto}
.fl-px{display:block;flex:none;width:1em;height:auto;fill:currentColor;shape-rendering:crispEdges}
.fl-btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--feega-space-2);min-height:44px;padding:0 var(--feega-space-6);border:1px solid var(--feega-line-strong);border-radius:var(--feega-radius-full);background:transparent;color:var(--feega-fg);font:inherit;font-size:0.9375rem;font-weight:500;letter-spacing:var(--feega-tracking);white-space:nowrap;text-decoration:none;cursor:pointer;transition:background-color var(--feega-dur-fast) var(--feega-ease),border-color var(--feega-dur-fast) var(--feega-ease),color var(--feega-dur-fast) var(--feega-ease),transform var(--feega-dur-fast) var(--feega-ease)}
.fl-btn:hover{border-color:var(--feega-fg-subtle);background:var(--feega-surface)}
.fl-btn:active{transform:scale(0.97)}
.fl-btn--primary{border-color:var(--feega-accent);background:var(--feega-accent);color:var(--feega-accent-fg)}
.fl-btn--primary:hover{border-color:var(--feega-accent-hover);background:var(--feega-accent-hover)}
.fl-btn--ink{border-color:var(--feega-fg);background:var(--feega-fg);color:var(--feega-bg)}
.fl-btn--ink:hover{border-color:var(--feega-fg-muted);background:var(--feega-fg-muted)}
.fl-btn--ghost{border-color:transparent}
.fl-btn--sm{min-height:36px;padding:0 var(--feega-space-4);font-size:var(--feega-text-sm)}
.fl-btn .fl-px{width:10px;transition:transform var(--feega-dur) var(--feega-ease)}
.fl-btn:hover .fl-px{transform:translateX(3px)}
.fl-btn[disabled]{opacity:0.45;cursor:not-allowed}
.fl-navbar{position:relative}
.fl-navbar .bar{display:flex;align-items:center;gap:var(--feega-space-6);min-height:72px}
.brand{display:inline-flex;align-items:center;gap:10px;font-size:1.125rem;font-weight:600;letter-spacing:-0.04em}
.brand .fl-px{width:16px;color:var(--feega-accent)}
.fl-navbar nav{flex:1;display:flex;justify-content:center}
.fl-navbar .links{display:flex;gap:var(--feega-space-1);padding:0;list-style:none}
.fl-navbar .links a{display:inline-flex;align-items:center;min-height:36px;padding:0 14px;border-radius:var(--feega-radius-full);color:var(--feega-fg-muted);font-weight:500;transition:background-color var(--feega-dur-fast) var(--feega-ease),color var(--feega-dur-fast) var(--feega-ease)}
.fl-navbar .links a:hover{background:var(--feega-surface);color:var(--feega-fg)}
.fl-navbar .links a[aria-current="page"]{color:var(--feega-fg)}
.fl-navbar .actions{display:flex;align-items:center;gap:var(--feega-space-4)}
.fl-navbar .login{font-weight:500;color:var(--feega-fg-muted);transition:color var(--feega-dur-fast) var(--feega-ease)}
.fl-navbar .login:hover{color:var(--feega-fg)}
.fl-navbar .menu{display:none;position:relative}
.fl-navbar .menu summary{display:grid;place-items:center;width:40px;height:40px;border-radius:var(--feega-radius-full);list-style:none;cursor:pointer;transition:background-color var(--feega-dur-fast) var(--feega-ease)}
.fl-navbar .menu summary::-webkit-details-marker{display:none}
.fl-navbar .menu summary:hover{background:var(--feega-surface)}
.fl-navbar .menu summary .fl-px{width:14px}
.fl-navbar .menu ul{position:absolute;top:calc(100% + 8px);right:0;z-index:10;display:grid;min-width:12rem;padding:var(--feega-space-2);border-radius:var(--feega-radius-md);background:var(--feega-raised);box-shadow:var(--feega-shadow-float);list-style:none;animation:fl-navbar-in var(--feega-dur) var(--feega-ease)}
.fl-navbar .menu ul a{display:block;padding:10px 12px;border-radius:var(--feega-radius-sm);font-weight:500}
.fl-navbar .menu ul a:hover{background:var(--feega-surface)}
@keyframes fl-navbar-in{from{opacity:0;transform:translateY(-6px) scale(0.98)}}
@media (max-width:820px){.fl-navbar nav,.fl-navbar .login{display:none}.fl-navbar .actions{margin-left:auto;gap:var(--feega-space-2)}.fl-navbar .menu{display:block}}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
