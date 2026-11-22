import './CtaSplit.css';

export function CtaSplit() {
  return (
    <section className="fl-cta-split">
      <div className="fl-container card">
        <h2>start building today</h2>
        <div className="side">
          <p>Free while you try it. No card, no call.</p>
          <div className="cta"><a className="fl-btn fl-btn--ink" href="#">get started <svg className="fl-px" viewBox="0 0 7 5" aria-hidden="true"><path d="M4 0h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM5 3h1v1h-1zM4 4h1v1h-1z" /></svg></a><a className="fl-btn ghost" href="#">talk to us</a></div>
        </div>
      </div>
    </section>
  );
}
