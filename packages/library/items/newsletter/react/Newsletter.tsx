import './Newsletter.css';

export function Newsletter() {
  return (
    <section className="fl-newsletter">
      <div className="fl-container card">
        <div className="copy">
          <span className="ic"><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M0 0h1v1h-1zM1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM6 0h1v1h-1zM7 0h1v1h-1zM0 1h1v1h-1zM1 1h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM2 2h1v1h-1zM5 2h1v1h-1zM7 2h1v1h-1zM0 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM7 3h1v1h-1zM0 4h1v1h-1zM7 4h1v1h-1zM0 5h1v1h-1zM1 5h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM5 5h1v1h-1zM6 5h1v1h-1zM7 5h1v1h-1z" /></svg></span>
          <h2>one useful email a month</h2>
          <p>What shipped, what we learned, nothing else.</p>
        </div>
        <form action="#">
          <label className="sr" htmlFor="fl-newsletter-email">Email</label>
          <div className="row"><input className="fl-input" id="fl-newsletter-email" type="email" placeholder="you@example.com" autoComplete="email" required /><button className="fl-btn fl-btn--primary" type="submit">subscribe</button></div>
          <small>No spam. Unsubscribe in one click.</small>
        </form>
      </div>
    </section>
  );
}
