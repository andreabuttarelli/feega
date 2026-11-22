import { describe, expect, it } from 'vitest';
import { EmailKind, renderEmail, type EmailData } from './templates';

const XSS = '<img src=x onerror=alert(1)>"';
const URL_ = 'https://oh.feega.app/app/x?a=1&b=2';
const DATE = new Date('2026-12-01T00:00:00Z');
const MANAGE_URL = 'https://oh.feega.app/app/settings/profile';

const SAMPLES: { [K in EmailKind]: EmailData[K] } = {
  [EmailKind.Welcome]: { name: XSS },
  [EmailKind.OrgInvite]: { inviter: XSS, org: XSS, role: 'editor', url: URL_ },
  [EmailKind.SessionShared]: { sharer: XSS, project: XSS, expiresAt: DATE, url: URL_ },
  [EmailKind.CommentsDigest]: {
    comments: [{ author: XSS, text: XSS, element: XSS, file: XSS, line: 12 }],
    url: URL_
  },
  [EmailKind.PromotedToEditor]: { session: XSS, url: URL_ },
  [EmailKind.PaymentSucceeded]: { plan: XSS, amountCents: 1900, currency: 'usd', renewsAt: DATE, url: URL_ },
  [EmailKind.PaymentFailed]: { plan: XSS, amountCents: 1900, currency: 'usd', url: URL_ },
  [EmailKind.SubscriptionEnding]: { plan: XSS, endsAt: DATE, url: URL_ }
};

const KINDS = Object.values(EmailKind);

describe.each(KINDS)('%s', (kind) => {
  const mail = renderEmail(kind, SAMPLES[kind] as never);

  it('has a one-line subject', () => {
    expect(mail.subject.length).toBeGreaterThan(0);
    expect(mail.subject).not.toMatch(/[\r\n]/);
  });

  it('escapes user data in the html', () => {
    expect(mail.html).not.toContain('<img src=x');
    expect(mail.html).not.toContain('onerror=alert(1)>');
    expect(mail.html).toContain('&lt;img src=x');
  });

  it('has a text part with the manage link', () => {
    expect(mail.text.length).toBeGreaterThan(0);
    expect(mail.text).toContain(MANAGE_URL);
  });

  it('ends with the reason and the manage link', () => {
    expect(mail.html).toContain('You get this because');
    expect(mail.html).toContain(`href="${MANAGE_URL}"`);
    expect(mail.text).toContain('You get this because');
  });

  it('has the logo and no tracking pixel', () => {
    expect(mail.html).toContain('https://www.feega.app/email/logo.png');
    expect(mail.html).not.toMatch(/width="1"|height="1"/);
    expect(mail.html.match(/<img/g)).toHaveLength(1);
  });
});

describe('links', () => {
  it('welcome points to the quick start', () => {
    const mail = renderEmail(EmailKind.Welcome, { name: 'Ada' });
    expect(mail.html).toContain('href="https://docs.feega.app/getting-started/quick-start/"');
    expect(mail.text).toContain('https://docs.feega.app/getting-started/quick-start/');
  });

  it('welcome names the three ways and marks the desktop app as beta', () => {
    const mail = renderEmail(EmailKind.Welcome, {});
    expect(mail.text).toContain('VS Code extension');
    expect(mail.text).toContain('npx feega');
    expect(mail.text).toMatch(/desktop app \(beta\)/i);
  });

  it('action links keep their query string, escaped in html and raw in text', () => {
    const mail = renderEmail(EmailKind.OrgInvite, { inviter: 'Ada', org: 'Acme', role: 'viewer', url: URL_ });
    expect(mail.html).toContain('href="https://oh.feega.app/app/x?a=1&amp;b=2"');
    expect(mail.text).toContain(URL_);
  });

  it('a quote in a link cannot break out of an attribute', () => {
    const mail = renderEmail(EmailKind.PromotedToEditor, { session: 'x', url: 'https://a.b/"onmouseover="x' });
    expect(mail.html).not.toContain('"onmouseover="x');
  });
});

describe('content', () => {
  it('the invite names inviter, org and role', () => {
    const mail = renderEmail(EmailKind.OrgInvite, { inviter: 'Ada', org: 'Acme', role: 'viewer', url: URL_ });
    expect(mail.subject).toContain('Ada');
    expect(mail.subject).toContain('Acme');
    expect(mail.text).toContain('viewer');
  });

  it('the share names the project and the expiry date', () => {
    const mail = renderEmail(EmailKind.SessionShared, { sharer: 'Ada', project: 'Pricing page', expiresAt: DATE, url: URL_ });
    expect(mail.text).toContain('Pricing page');
    expect(mail.text).toContain('1 December 2026');
  });

  it('the digest lists every comment with its place', () => {
    const mail = renderEmail(EmailKind.CommentsDigest, {
      comments: [
        { author: 'Ada', text: 'Too tight', element: 'button.cta', file: 'src/App.tsx', line: 12 },
        { author: 'Bo', text: 'Wrong blue', element: 'h1', file: 'src/Hero.tsx', line: 3 }
      ],
      url: URL_
    });
    expect(mail.subject).toContain('2 new comments');
    expect(mail.text).toContain('Ada: Too tight');
    expect(mail.text).toContain('button.cta');
    expect(mail.text).toContain('src/App.tsx:12');
    expect(mail.text).toContain('src/Hero.tsx:3');
  });

  it('the digest of one comment is singular', () => {
    const mail = renderEmail(EmailKind.CommentsDigest, {
      comments: [{ author: 'Ada', text: 'Hi', element: 'h1', file: 'a.ts', line: 1 }],
      url: URL_
    });
    expect(mail.subject).toContain('1 new comment');
    expect(mail.subject).not.toContain('comments');
  });

  it('payment succeeded shows plan, amount and next renewal', () => {
    const mail = renderEmail(EmailKind.PaymentSucceeded, { plan: 'Cloud', amountCents: 1900, currency: 'usd', renewsAt: DATE, url: URL_ });
    expect(mail.text).toContain('Cloud');
    expect(mail.text).toContain('$19.00');
    expect(mail.text).toContain('1 December 2026');
  });

  it('payment failed says what to do', () => {
    const mail = renderEmail(EmailKind.PaymentFailed, { plan: 'Cloud', amountCents: 1900, currency: 'usd', url: URL_ });
    expect(mail.text).toContain('$19.00');
    expect(mail.text).toMatch(/update your payment method/i);
  });

  it('the ending notice says what is lost and links to renew', () => {
    const mail = renderEmail(EmailKind.SubscriptionEnding, { plan: 'Cloud', endsAt: DATE, url: URL_ });
    expect(mail.subject).toContain('3 days');
    expect(mail.text).toMatch(/lose/i);
    expect(mail.text).toContain(URL_);
  });
});

describe('subject', () => {
  it('a newline in a name cannot add a header', () => {
    const mail = renderEmail(EmailKind.OrgInvite, { inviter: 'Ada\r\nBcc: x@y.z', org: 'Acme', role: 'viewer', url: URL_ });
    expect(mail.subject).not.toMatch(/[\r\n]/);
  });
});
