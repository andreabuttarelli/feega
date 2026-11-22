import './CtaBand.css';

export function CtaBand() {
  return (
    <section className="fl-cta-band">
      <div className="fl-container">
        <div className="band">
          <div className="field" aria-hidden="true"></div>
          <h2>ready when you are</h2>
          <p>Set up in two minutes. Free until your team grows.</p>
          <div className="cta">
            <a className="fl-btn fl-btn--primary" href="#">get started free</a>
            <a className="fl-btn on-ink" href="#">talk to us <svg className="fl-px" viewBox="0 0 7 5" aria-hidden="true"><path d="M4 0h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM5 3h1v1h-1zM4 4h1v1h-1z" /></svg></a>
          </div>
        </div>
      </div>
    </section>
  );
}
