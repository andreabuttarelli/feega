import './QuoteBlock.css';

export function QuoteBlock() {
  return (
    <section className="fl-quote-block">
      <figure className="fl-container inner">
        <svg className="fl-px" viewBox="0 0 6 4" aria-hidden="true"><path d="M0 0h1v1h-1zM1 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM0 1h1v1h-1zM1 1h1v1h-1zM4 1h1v1h-1zM5 1h1v1h-1zM1 2h1v1h-1zM5 2h1v1h-1zM0 3h1v1h-1zM4 3h1v1h-1z" /></svg>
        <blockquote>
          <p>Replace this with a real quote from a customer. Keep it short, specific, and in their own words.</p>
        </blockquote>
        <figcaption>
          <span className="fl-avatar" aria-hidden="true">NS</span>
          <span className="who"><b>Name Surname</b><span>Role, Company</span></span>
        </figcaption>
      </figure>
    </section>
  );
}
