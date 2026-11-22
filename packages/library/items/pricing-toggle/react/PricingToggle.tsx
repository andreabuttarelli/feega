import './PricingToggle.css';

export function PricingToggle() {
  return (
    <section className="fl-pricing-toggle">
      <div className="fl-container head">
        <p className="fl-eyebrow">pricing</p>
        <h2 className="fl-title">simple pricing</h2>
        <label className="bill">monthly <input className="fl-switch" type="checkbox" aria-label="Bill annually" /> annual <span className="save">save 20%</span></label>
      </div>
      <ul className="fl-container plans">
        <li className="plan">
          <h3>starter</h3>
          <p className="price"><b className="m">$0</b><b className="a">$0</b><span>per seat / month</span></p>
          <p className="desc">For trying it out.</p>
          <a className="fl-btn" href="#">start free</a>
          <ul><li><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg>3 projects</li><li><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg>community support</li></ul>
        </li>
        <li className="plan hot">
          <h3>pro</h3>
          <p className="price"><b className="m">$15</b><b className="a">$12</b><span>per seat / month</span></p>
          <p className="desc">For small teams shipping weekly.</p>
          <a className="fl-btn fl-btn--primary" href="#">start trial</a>
          <ul><li><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg>unlimited projects</li><li><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg>custom domain</li><li><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg>priority support</li></ul>
        </li>
        <li className="plan">
          <h3>business</h3>
          <p className="price"><b className="m">$49</b><b className="a">$39</b><span>per seat / month</span></p>
          <p className="desc">For security reviews and SSO.</p>
          <a className="fl-btn" href="#">talk to sales</a>
          <ul><li><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg>SSO and audit log</li><li><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg>roles</li><li><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg>onboarding</li></ul>
        </li>
      </ul>
    </section>
  );
}
