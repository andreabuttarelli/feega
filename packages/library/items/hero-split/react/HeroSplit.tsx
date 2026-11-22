import './HeroSplit.css';

export function HeroSplit() {
  return (
    <section className="fl-hero-split">
      <div className="fl-container grid">
        <div className="copy">
          <p className="fl-eyebrow">for product teams</p>
          <h1 className="fl-title">from idea to shipped, in one place</h1>
          <p className="fl-lead">Say what the product does and why it matters, in one or two sentences a busy person reads in full.</p>
          <div className="cta">
            <a className="fl-btn fl-btn--primary" href="#">start building</a>
            <a className="fl-btn fl-btn--ghost" href="#">see how it works <svg className="fl-px" viewBox="0 0 7 5" aria-hidden="true"><path d="M4 0h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM5 3h1v1h-1zM4 4h1v1h-1z" /></svg></a>
          </div>
          <dl className="stats">
            <div><dt>setup</dt><dd>2 min</dd></div>
            <div><dt>uptime</dt><dd>99.9%</dd></div>
            <div><dt>plan</dt><dd>free</dd></div>
          </dl>
        </div>
        <div className="stage fl-dots" role="img" aria-label="Placeholder product illustration">
          <div className="window">
            <div className="chrome"><span></span><span></span><span></span><b>yourbrand.app</b></div>
            <div className="page">
              <div className="nav"><i></i><i></i><i></i></div>
              <div className="headline">
                <div className="line"></div>
                <div className="line short"></div>
                <div className="sel" aria-hidden="true"><span className="tag">h1.title</span><i></i><i></i><i></i><i></i></div>
              </div>
              <div className="text"></div>
              <div className="buttons"><i></i><i></i></div>
              <div className="tiles"><i></i><i></i><i></i></div>
            </div>
          </div>
          <div className="cursor"><svg className="fl-px" viewBox="0 0 8 9" aria-hidden="true"><path d="M0 0h1v1h-1zM0 1h1v1h-1zM1 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM0 4h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM0 5h1v1h-1zM1 5h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM5 5h1v1h-1zM0 6h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM0 7h1v1h-1zM3 7h1v1h-1zM4 7h1v1h-1zM4 8h1v1h-1zM5 8h1v1h-1z" /></svg></div>
        </div>
      </div>
    </section>
  );
}
