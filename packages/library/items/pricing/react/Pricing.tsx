import './Pricing.css';

export function Pricing() {
  return (
    <section className="fl-pricing">
      <div className="fl-container">
        <div className="head">
          <h2 className="fl-title">pricing</h2>
          <p className="fl-lead">Start free. Pay when the team grows. Every plan has every core feature.</p>
        </div>
        <div className="tiers">
          <article>
            <h3>starter</h3>
            <p className="price"><strong>$0</strong><span>forever</span></p>
            <p className="note">For trying it out on a side project.</p>
            <a className="fl-btn" href="#">start free</a>
            <ul>
              <li><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg>up to 3 projects</li>
              <li><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg>community support</li>
              <li><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg>1 GB storage</li>
            </ul>
          </article>
          <article className="featured">
            <h3>pro <span className="tag">popular</span></h3>
            <p className="price"><strong>$12</strong><span>per seat / month</span></p>
            <p className="note">For small teams shipping every week.</p>
            <a className="fl-btn fl-btn--primary" href="#">start 14-day trial</a>
            <ul>
              <li><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg>unlimited projects</li>
              <li><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg>custom domain</li>
              <li><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg>priority support</li>
            </ul>
          </article>
          <article>
            <h3>business</h3>
            <p className="price"><strong>$49</strong><span>per seat / month</span></p>
            <p className="note">For companies with security reviews.</p>
            <a className="fl-btn" href="#">talk to sales</a>
            <ul>
              <li><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg>SSO and audit log</li>
              <li><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg>roles and permissions</li>
              <li><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg>dedicated onboarding</li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
