import './LoginForm.css';

export function LoginForm() {
  return (
    <section className="fl-login-form fl-dots">
      <form className="card" method="post" action="#">
        <span className="logo"><svg className="fl-px" viewBox="0 0 5 5" aria-hidden="true"><path d="M2 0h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM2 4h1v1h-1z" /></svg></span>
        <h1>Log in to Yourbrand</h1>
        <p className="sub">Welcome back. Use your work email.</p>
        <button className="fl-btn sso" type="button"><svg className="fl-px" viewBox="0 0 8 8" aria-hidden="true"><path d="M2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM5 1h1v1h-1zM6 1h1v1h-1zM1 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM6 3h1v1h-1zM7 3h1v1h-1zM0 4h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM7 4h1v1h-1zM0 5h1v1h-1zM1 5h1v1h-1zM2 5h1v1h-1zM5 5h1v1h-1zM6 5h1v1h-1zM7 5h1v1h-1zM0 6h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM3 6h1v1h-1zM4 6h1v1h-1zM5 6h1v1h-1zM6 6h1v1h-1zM7 6h1v1h-1zM0 7h1v1h-1zM1 7h1v1h-1zM2 7h1v1h-1zM3 7h1v1h-1zM4 7h1v1h-1zM5 7h1v1h-1zM6 7h1v1h-1zM7 7h1v1h-1z" /></svg>Continue with SSO</button>
        <p className="or"><span>or</span></p>
        <label className="fl-field">Email<input className="fl-input" type="email" name="email" placeholder="you@example.com" autoComplete="email" required /></label>
        <label className="fl-field"><span className="row">Password<a href="#">Forgot?</a></span><input className="fl-input" type="password" name="password" autoComplete="current-password" required /></label>
        <label className="fl-check"><input type="checkbox" name="remember" />Keep me logged in</label>
        <button className="fl-btn fl-btn--primary" type="submit">Log in</button>
        <p className="alt">No account? <a href="#">Sign up</a></p>
      </form>
    </section>
  );
}
