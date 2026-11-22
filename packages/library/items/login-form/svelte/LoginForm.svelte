<section class="fl-login-form">
  <form class="card" method="post" action="#">
    <h1>Log in</h1>
    <label class="fl-field">Email<input type="email" name="email" autocomplete="email" required /></label>
    <label class="fl-field">Password<input type="password" name="password" autocomplete="current-password" required /></label>
    <label class="fl-check"><input type="checkbox" name="remember" />Remember me</label>
    <button class="fl-btn fl-btn--primary" type="submit">Log in</button>
    <p class="alt"><a href="#">Forgot your password?</a></p>
  </form>
</section>

<style>
.fl-btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--feega-space-2);min-height:40px;padding:0 var(--feega-space-4);border:1px solid var(--feega-line);border-radius:var(--feega-radius-sm);background:var(--feega-raised);color:var(--feega-fg);font:inherit;font-weight:500;text-decoration:none;cursor:pointer}
.fl-btn:hover{background:var(--feega-surface)}
.fl-btn--primary{background:var(--feega-accent);border-color:var(--feega-accent);color:var(--feega-accent-fg)}
.fl-btn--primary:hover{background:var(--feega-accent);opacity:0.9}
.fl-btn[disabled]{opacity:0.5;cursor:not-allowed}
.fl-field{display:grid;gap:var(--feega-space-1);font-size:0.875rem;font-weight:500}
.fl-field input,.fl-field select,.fl-field textarea{width:100%;min-height:40px;padding:0 var(--feega-space-3);border:1px solid var(--feega-line);border-radius:var(--feega-radius-sm);background:var(--feega-surface);color:var(--feega-fg);font:inherit;font-weight:400}
.fl-field input:hover,.fl-field select:hover{border-color:var(--feega-fg-muted)}
.fl-field .hint{font-weight:400;color:var(--feega-fg-muted)}
.fl-check{display:flex;align-items:center;gap:var(--feega-space-2);font-size:0.875rem}
.fl-check input{width:1.125rem;height:1.125rem;accent-color:var(--feega-accent)}
.fl-login-form{font-family:var(--feega-font);line-height:1.5;color:var(--feega-fg);background:var(--feega-bg)}
.fl-login-form *,.fl-login-form *::before,.fl-login-form *::after{box-sizing:border-box}
.fl-login-form a{color:inherit}
.fl-login-form :focus-visible{outline:2px solid var(--feega-focus);outline-offset:2px}
.fl-login-form{display:grid;place-items:center;padding:var(--feega-space-8) var(--feega-gutter)}
.fl-login-form .card{display:grid;gap:var(--feega-space-4);width:min(100%,24rem);padding:var(--feega-space-6);border:1px solid var(--feega-line);border-radius:var(--feega-radius-lg);background:var(--feega-raised)}
.fl-login-form h1{margin:0;font-size:1.5rem;font-weight:600;letter-spacing:-0.03em}
.fl-login-form .alt{margin:0;text-align:center;font-size:0.875rem}
.fl-login-form .alt a{color:var(--feega-accent)}
</style>
