import './CtaBand.css';

export function CtaBand() {
  return (
    <section className="fl-cta-band">
      <div className="fl-container">
        <div className="band">
          <div className="field" aria-hidden="true"></div>
          <h2>have a project in mind?</h2>
          <p>Tell us what you are building. We reply within a day.</p>
          <div className="cta">
            <a className="fl-btn fl-btn--primary" href="#">start a project</a>
            <a className="fl-btn on-ink" href="#">see pricing <svg className="fl-px" viewBox="0 0 7 5" aria-hidden="true"><path d="M4 0h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM5 3h1v1h-1zM4 4h1v1h-1z" /></svg></a>
          </div>
        </div>
      </div>
    </section>
  );
}
