import './Pricing.css';

export function Pricing() {
  return (
    <section className="fl-pricing">
      <div className="fl-container">
        <div className="head">
          <h2 className="fl-title">Simple pricing</h2>
          <p className="fl-lead">Start free. Upgrade when you need more.</p>
        </div>
        <div className="tiers">
          <article>
            <h3>Free</h3>
            <p className="price"><strong>$0</strong> <span>/ month</span></p>
            <ul><li>Feature one</li><li>Feature two</li><li>Feature three</li></ul>
            <a className="fl-btn" href="#">Get started</a>
          </article>
          <article className="featured">
            <h3>Pro <span className="fl-badge">Popular</span></h3>
            <p className="price"><strong>$12</strong> <span>/ month</span></p>
            <ul><li>Everything in Free</li><li>Feature four</li><li>Feature five</li></ul>
            <a className="fl-btn fl-btn--primary" href="#">Start Pro</a>
          </article>
          <article>
            <h3>Team</h3>
            <p className="price"><strong>$49</strong> <span>/ month</span></p>
            <ul><li>Everything in Pro</li><li>Feature six</li><li>Feature seven</li></ul>
            <a className="fl-btn" href="#">Contact us</a>
          </article>
        </div>
      </div>
    </section>
  );
}
