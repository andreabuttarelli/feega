import './HeroCode.css';

export function HeroCode() {
  return (
    <section className="fl-hero-code">
      <div className="fl-container grid">
        <div className="copy">
          <p className="fl-eyebrow">for developers</p>
          <h1 className="fl-title">one command, then it just works</h1>
          <p className="fl-lead">Say what runs after install and what the developer no longer has to do by hand.</p>
          <div className="cta">
            <a className="fl-btn fl-btn--primary" href="#">read the docs</a>
            <a className="fl-btn fl-btn--ghost" href="#">view on GitHub <svg className="fl-px" viewBox="0 0 7 5" aria-hidden="true"><path d="M4 0h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM5 3h1v1h-1zM4 4h1v1h-1z" /></svg></a>
          </div>
        </div>
        <figure className="term" aria-label="Terminal example">
          <div className="bar"><i></i><i></i><i></i><span>terminal</span></div>
          <pre><code><span className="p">$</span> npx yourbrand init<br /><span className="m">✓ found a Vite project</span><br /><span className="m">✓ added the plugin to vite.config.ts</span><br /><span className="m">✓ wrote yourbrand.json</span><br /><br /><span className="p">$</span> npm run dev<br /><span className="a">ready</span> <span className="m">in 312 ms on</span> localhost:5173<span className="caret"></span></code></pre>
        </figure>
      </div>
    </section>
  );
}
