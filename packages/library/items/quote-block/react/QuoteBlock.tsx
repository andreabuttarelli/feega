import './QuoteBlock.css';

export function QuoteBlock() {
  return (
    <section className="fl-quote-block">
      <div className="fl-container">
        <h2 className="fl-title">What people say</h2>
        <p className="notice"><span className="fl-badge">Placeholder</span> Replace this text with real customer quotes.</p>
        <div className="grid">
          <figure>
            <blockquote><p>Placeholder quote. Replace with a real customer sentence.</p></blockquote>
            <figcaption>Placeholder name <span>Role, Company</span></figcaption>
          </figure>
          <figure>
            <blockquote><p>Placeholder quote. Replace with a real customer sentence.</p></blockquote>
            <figcaption>Placeholder name <span>Role, Company</span></figcaption>
          </figure>
          <figure>
            <blockquote><p>Placeholder quote. Replace with a real customer sentence.</p></blockquote>
            <figcaption>Placeholder name <span>Role, Company</span></figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
