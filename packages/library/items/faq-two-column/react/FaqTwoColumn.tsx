import './FaqTwoColumn.css';

export function FaqTwoColumn() {
  return (
    <section className="fl-faq-two-column">
      <div className="fl-container head">
        <p className="fl-eyebrow">faq</p>
        <h2 className="fl-title">questions, answered</h2>
      </div>
      <dl className="fl-container grid">
        <div><dt>Is there a free plan?</dt><dd>Yes. The starter plan is free forever and has every core feature.</dd></div>
        <div><dt>Can I cancel anytime?</dt><dd>Yes. Cancel from settings; you keep access until the period ends.</dd></div>
        <div><dt>Where is my data stored?</dt><dd>In the region you pick at signup. Placeholder: say which.</dd></div>
        <div><dt>Do you offer discounts?</dt><dd>Education and non-profit teams get 50% off. Write to us.</dd></div>
        <div><dt>Does it work with my framework?</dt><dd>Svelte, React, Vue and Astro today. Placeholder list.</dd></div>
        <div><dt>How do I get help?</dt><dd>Docs first, then chat. A person replies within a day.</dd></div>
      </dl>
    </section>
  );
}
