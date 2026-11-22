import './LoginForm.css';

export function LoginForm() {
  return (
    <section className="fl-login-form">
      <form className="card" method="post" action="#">
        <h1>Log in</h1>
        <label className="fl-field">Email<input type="email" name="email" autoComplete="email" required /></label>
        <label className="fl-field">Password<input type="password" name="password" autoComplete="current-password" required /></label>
        <label className="fl-check"><input type="checkbox" name="remember" />Remember me</label>
        <button className="fl-btn fl-btn--primary" type="submit">Log in</button>
        <p className="alt"><a href="#">Forgot your password?</a></p>
      </form>
    </section>
  );
}
