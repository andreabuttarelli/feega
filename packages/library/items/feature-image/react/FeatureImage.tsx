import './FeatureImage.css';

export function FeatureImage() {
  return (
    <section className="fl-feature-image">
      <div className="fl-container inner">
        <div className="fl-media" role="img" aria-label="Placeholder image"></div>
        <div className="copy">
          <h2 className="fl-title">One feature, explained properly</h2>
          <p className="fl-lead">Say what it does and why it matters in two sentences.</p>
          <ul className="points">
            <li><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10" /></svg><span>First supporting point</span></li>
            <li><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10" /></svg><span>Second supporting point</span></li>
            <li><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10" /></svg><span>Third supporting point</span></li>
          </ul>
          <a className="fl-btn" href="#">Learn more</a>
        </div>
      </div>
    </section>
  );
}
