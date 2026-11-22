import './HeroSplit.css';

export function HeroSplit() {
  return (
    <section className="fl-hero-split">
      <div className="fl-container inner">
        <div className="copy">
          <h1>Headline that says what you do</h1>
          <p className="lead">One or two sentences that explain the product and who it is for.</p>
          <div className="actions">
            <a className="fl-btn fl-btn--primary" href="#">Get started</a>
            <a className="fl-btn" href="#">Learn more</a>
          </div>
        </div>
        <div className="fl-media" role="img" aria-label="Placeholder image"></div>
      </div>
    </section>
  );
}
