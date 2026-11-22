<template>
  <section class="fl-login-form fl-dots">
    <form class="card" method="post" action="#">
      <span class="logo"><svg class="fl-px" viewBox="0 0 5 5" aria-hidden="true"><path d="M2 0h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM2 4h1v1h-1z" /></svg></span>
      <h1>Log in to Yourbrand</h1>
      <p class="sub">Welcome back. Use your work email.</p>
      <button class="fl-btn sso" type="button"><svg class="fl-px" viewBox="0 0 8 8" aria-hidden="true"><path d="M2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM5 1h1v1h-1zM6 1h1v1h-1zM1 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM6 3h1v1h-1zM7 3h1v1h-1zM0 4h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM7 4h1v1h-1zM0 5h1v1h-1zM1 5h1v1h-1zM2 5h1v1h-1zM5 5h1v1h-1zM6 5h1v1h-1zM7 5h1v1h-1zM0 6h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM3 6h1v1h-1zM4 6h1v1h-1zM5 6h1v1h-1zM6 6h1v1h-1zM7 6h1v1h-1zM0 7h1v1h-1zM1 7h1v1h-1zM2 7h1v1h-1zM3 7h1v1h-1zM4 7h1v1h-1zM5 7h1v1h-1zM6 7h1v1h-1zM7 7h1v1h-1z" /></svg>Continue with SSO</button>
      <p class="or"><span>or</span></p>
      <label class="fl-field">Email<input class="fl-input" type="email" name="email" placeholder="you@example.com" autocomplete="email" required /></label>
      <label class="fl-field"><span class="row">Password<a href="#">Forgot?</a></span><input class="fl-input" type="password" name="password" autocomplete="current-password" required /></label>
      <label class="fl-check"><input type="checkbox" name="remember" />Keep me logged in</label>
      <button class="fl-btn fl-btn--primary" type="submit">Log in</button>
      <p class="alt">No account? <a href="#">Sign up</a></p>
    </form>
  </section>
</template>

<style scoped>
.fl-login-form{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-login-form) *,:where(.fl-login-form) *::before,:where(.fl-login-form) *::after{box-sizing:border-box}
:where(.fl-login-form) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-login-form) a{color:inherit;text-decoration:none}
:where(.fl-login-form) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
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
.fl-field{display:grid;gap:var(--feega-space-2);font-size:var(--feega-text-sm);font-weight:500}
.fl-input{width:100%;min-height:44px;padding:0 var(--feega-space-4);border:1px solid var(--feega-line);border-radius:var(--feega-radius-md);background:var(--feega-input);color:var(--feega-fg);font:inherit;font-size:var(--feega-text-body);font-weight:400;letter-spacing:var(--feega-tracking);transition:border-color var(--feega-dur-fast) var(--feega-ease),box-shadow var(--feega-dur-fast) var(--feega-ease)}
.fl-input::placeholder{color:var(--feega-fg-subtle)}
.fl-input:hover{border-color:var(--feega-line-strong)}
.fl-input:focus{outline:none;border-color:var(--feega-accent);box-shadow:0 0 0 4px var(--feega-accent-soft)}
.fl-check{display:inline-flex;align-items:center;gap:var(--feega-space-3);font-size:var(--feega-text-sm);cursor:pointer}
.fl-check input{appearance:none;display:grid;place-items:center;width:18px;height:18px;margin:0;border:1px solid var(--feega-line-strong);border-radius:var(--feega-radius-xs);background:var(--feega-input);cursor:pointer;transition:background-color var(--feega-dur-fast) var(--feega-ease),border-color var(--feega-dur-fast) var(--feega-ease)}
.fl-check input::after{content:"";width:8px;height:8px;background:var(--feega-accent-fg);transform:scale(0);transition:transform var(--feega-dur) var(--feega-ease)}
.fl-check input:checked{border-color:var(--feega-accent);background:var(--feega-accent)}
.fl-check input:checked::after{transform:scale(1)}
.fl-dots{background-image:radial-gradient(var(--feega-dot) 1px,transparent 1.5px);background-size:14px 14px}
.fl-login-form{display:grid;place-items:center;min-height:640px;padding:var(--feega-space-12) var(--feega-gutter);background-color:var(--feega-surface)}
.fl-login-form .card{display:grid;gap:var(--feega-space-4);width:min(100%,25rem);padding:var(--feega-space-8);border-radius:var(--feega-radius-lg);background:var(--feega-raised);box-shadow:var(--feega-shadow-float);animation:fl-login-form-in var(--feega-dur) var(--feega-ease)}
@keyframes fl-login-form-in{from{opacity:0;transform:translateY(8px)}}
.fl-login-form .logo{display:grid;place-items:center;width:44px;height:44px;margin-bottom:var(--feega-space-2);border-radius:var(--feega-radius-md);background:var(--feega-fg);color:var(--feega-accent)}
.fl-login-form .logo .fl-px{width:18px}
.fl-login-form h1{font-size:1.375rem;font-weight:600;letter-spacing:-0.04em}
.fl-login-form .sub{margin-top:-10px;color:var(--feega-fg-muted);font-size:var(--feega-text-sm)}
.fl-login-form .fl-btn{width:100%}
.fl-login-form .sso .fl-px{width:12px}
.fl-login-form .sso:hover .fl-px{transform:none}
.fl-login-form .or{display:flex;align-items:center;gap:var(--feega-space-3);color:var(--feega-fg-subtle);font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);text-transform:uppercase}
.fl-login-form .or::before,.fl-login-form .or::after{content:"";flex:1;height:1px;background:var(--feega-line)}
.fl-login-form .row{display:flex;justify-content:space-between}
.fl-login-form .row a,.fl-login-form .alt a{color:var(--feega-accent-text);font-weight:500}
.fl-login-form .row a:hover,.fl-login-form .alt a:hover{text-decoration:underline;text-underline-offset:3px}
.fl-login-form .alt{color:var(--feega-fg-muted);font-size:var(--feega-text-sm);text-align:center}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
