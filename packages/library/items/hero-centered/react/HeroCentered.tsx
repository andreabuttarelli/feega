import './HeroCentered.css';

export function HeroCentered() {
  return (
    <section className="fl-hero-centered">
      <div className="fl-container inner">
        <p className="fl-badge">New</p>
        <h1>Headline that says what you do</h1>
        <p className="lead">One or two sentences that explain the product and who it is for.</p>
        <div className="actions">
          <a className="fl-btn fl-btn--primary" href="#">Get started</a>
          <a className="fl-btn" href="#">Learn more</a>
        </div>
      </div>
    </section>
  );
}
