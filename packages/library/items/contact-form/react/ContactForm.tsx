import './ContactForm.css';

export function ContactForm() {
  return (
    <section className="fl-contact-form">
      <div className="fl-container grid">
        <div className="copy">
          <p className="fl-eyebrow">contact</p>
          <h2 className="fl-title">talk to a person</h2>
          <p className="fl-lead">We answer within one working day.</p>
          <ul>
            <li><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M0 0h1v1h-1zM1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM6 0h1v1h-1zM7 0h1v1h-1zM0 1h1v1h-1zM1 1h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM2 2h1v1h-1zM5 2h1v1h-1zM7 2h1v1h-1zM0 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM7 3h1v1h-1zM0 4h1v1h-1zM7 4h1v1h-1zM0 5h1v1h-1zM1 5h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM5 5h1v1h-1zM6 5h1v1h-1zM7 5h1v1h-1z" /></svg><a href="#">hi@example.com</a></li>
            <li><svg className="fl-px" viewBox="0 0 8 7" aria-hidden="true"><path d="M0 0h1v1h-1zM1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM6 0h1v1h-1zM7 0h1v1h-1zM0 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM5 2h1v1h-1zM7 2h1v1h-1zM0 3h1v1h-1zM7 3h1v1h-1zM0 4h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM7 4h1v1h-1zM1 5h1v1h-1zM2 5h1v1h-1zM1 6h1v1h-1z" /></svg><a href="#">live chat, 9 to 6</a></li>
            <li><svg className="fl-px" viewBox="0 0 7 7" aria-hidden="true"><path d="M2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM1 1h1v1h-1zM3 1h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM3 3h1v1h-1zM6 3h1v1h-1zM0 4h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM1 5h1v1h-1zM3 5h1v1h-1zM5 5h1v1h-1zM2 6h1v1h-1zM3 6h1v1h-1zM4 6h1v1h-1z" /></svg><span>Placeholder City, Country</span></li>
          </ul>
        </div>
        <form className="form" action="#">
          <div className="two">
            <label className="fl-field" htmlFor="fl-contact-name">Name<input className="fl-input" id="fl-contact-name" type="text" autoComplete="name" placeholder="Name Surname" required /></label>
            <label className="fl-field" htmlFor="fl-contact-email">Email<input className="fl-input" id="fl-contact-email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
          </div>
          <label className="fl-field" htmlFor="fl-contact-topic">Topic<select className="fl-input" id="fl-contact-topic"><option>Sales</option><option>Support</option><option>Press</option></select></label>
          <label className="fl-field" htmlFor="fl-contact-message">Message<textarea className="fl-input" id="fl-contact-message" rows="5" placeholder="How can we help?" required></textarea></label>
          <button className="fl-btn fl-btn--primary" type="submit">send message <svg className="fl-px" viewBox="0 0 7 5" aria-hidden="true"><path d="M4 0h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM5 3h1v1h-1zM4 4h1v1h-1z" /></svg></button>
        </form>
      </div>
    </section>
  );
}
