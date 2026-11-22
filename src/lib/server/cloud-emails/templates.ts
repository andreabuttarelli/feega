export enum EmailKind {
  Welcome = 'welcome',
  OrgInvite = 'org_invite',
  SessionShared = 'session_shared',
  CommentsDigest = 'comments_digest',
  PromotedToEditor = 'promoted_to_editor',
  PaymentSucceeded = 'payment_succeeded',
  PaymentFailed = 'payment_failed',
  SubscriptionEnding = 'subscription_ending'
}

export type DigestComment = { author: string; text: string; element: string; file: string; line: number };

export type EmailData = {
  [EmailKind.Welcome]: { name?: string };
  [EmailKind.OrgInvite]: { inviter: string; org: string; role: 'viewer' | 'editor'; url: string };
  [EmailKind.SessionShared]: { sharer: string; project: string; expiresAt: Date; url: string };
  [EmailKind.CommentsDigest]: { comments: DigestComment[]; url: string };
  [EmailKind.PromotedToEditor]: { session: string; url: string };
  [EmailKind.PaymentSucceeded]: { plan: string; amountCents: number; currency: string; renewsAt: Date; url: string };
  [EmailKind.PaymentFailed]: { plan: string; amountCents: number; currency: string; url: string };
  [EmailKind.SubscriptionEnding]: { plan: string; endsAt: Date; url: string };
};

export type RenderedEmail = { subject: string; html: string; text: string };

const LOGO_URL = 'https://www.feega.app/email/logo.png';
const MANAGE_URL = 'https://oh.feega.app/app/settings/profile';
const QUICK_START_URL = 'https://docs.feega.app/getting-started/quick-start/';
const LOGO_SIZE_PX = 24;
const CENTS_PER_UNIT = 100;

type Item = { main: string; note?: string };

type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: Item[] }
  | { kind: 'link'; label: string; url: string };

type Content = { subject: string; reason: string; blocks: Block[] };

const paragraph = (text: string): Block => ({ kind: 'paragraph', text });
const list = (items: Item[]): Block => ({ kind: 'list', items });
const link = (label: string, url: string): Block => ({ kind: 'link', label, url });

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / CENTS_PER_UNIT);
}

function day(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

const CONTENT: { [K in EmailKind]: (data: EmailData[K]) => Content } = {
  [EmailKind.Welcome]: ({ name }) => ({
    subject: 'Welcome to Feega',
    reason: 'you signed in to Feega',
    blocks: [
      paragraph(name ? `Hi ${name},` : 'Hi,'),
      paragraph('Feega lets you select an element in your running app, edit it, and the change lands in your source code.'),
      paragraph('There are three ways to use it:'),
      list([
        { main: 'The VS Code extension' },
        { main: 'npx feega, from any terminal' },
        { main: 'The desktop app (beta)' }
      ]),
      link('Open the quick start', QUICK_START_URL)
    ]
  }),

  [EmailKind.OrgInvite]: ({ inviter, org, role, url }) => ({
    subject: `${oneLine(inviter)} invited you to ${oneLine(org)} on Feega`,
    reason: 'someone invited you to a team on Feega',
    blocks: [
      paragraph(`${inviter} invited you to join ${org} on Feega as a ${role}.`),
      link('Accept the invite', url)
    ]
  }),

  [EmailKind.SessionShared]: ({ sharer, project, expiresAt, url }) => ({
    subject: `${oneLine(sharer)} shared ${oneLine(project)} with you`,
    reason: 'someone shared a session with you on Feega',
    blocks: [
      paragraph(`${sharer} shared the session for ${project} with you. The link works until ${day(expiresAt)}.`),
      link('Open the session', url)
    ]
  }),

  [EmailKind.CommentsDigest]: ({ comments, url }) => ({
    subject: `${plural(comments.length, 'new comment')} on Feega`,
    reason: 'people commented on your sessions',
    blocks: [
      paragraph(`You have ${plural(comments.length, 'new comment')}:`),
      list(comments.map((c) => ({ main: `${c.author}: ${c.text}`, note: `${c.element} in ${c.file}:${c.line}` }))),
      link('Open the comments', url)
    ]
  }),

  [EmailKind.PromotedToEditor]: ({ session, url }) => ({
    subject: `You can now edit ${oneLine(session)}`,
    reason: 'your access to a session changed',
    blocks: [paragraph(`You were promoted to editor on ${session}. You can now make changes, not just view them.`), link('Open the session', url)]
  }),

  [EmailKind.PaymentSucceeded]: ({ plan, amountCents, currency, renewsAt, url }) => ({
    subject: 'Payment received, thank you',
    reason: 'you have a Feega subscription',
    blocks: [
      paragraph(`We received your payment of ${money(amountCents, currency)} for the ${plan} plan. It renews on ${day(renewsAt)}.`),
      link('Manage your subscription', url)
    ]
  }),

  [EmailKind.PaymentFailed]: ({ plan, amountCents, currency, url }) => ({
    subject: 'Your Feega payment failed',
    reason: 'you have a Feega subscription',
    blocks: [
      paragraph(`We could not charge ${money(amountCents, currency)} for the ${plan} plan.`),
      paragraph('Please update your payment method so your plan stays active.'),
      link('Update payment method', url)
    ]
  }),

  [EmailKind.SubscriptionEnding]: ({ plan, endsAt, url }) => ({
    subject: `Your Feega ${oneLine(plan)} plan ends in 3 days`,
    reason: 'you have a Feega subscription',
    blocks: [
      paragraph(`Your ${plan} plan ends on ${day(endsAt)}. After that you will lose:`),
      list([{ main: 'Shared sessions and their links' }, { main: 'Comments from your team' }, { main: 'Cloud previews' }]),
      link('Renew your plan', url)
    ]
  })
};

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const TEXT_STYLE = 'margin:0 0 16px;';
const BUTTON_STYLE =
  'display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;';

const HTML_BLOCK: { [K in Block['kind']]: (block: Extract<Block, { kind: K }>) => string } = {
  paragraph: (b) => `<p style="${TEXT_STYLE}">${esc(b.text)}</p>`,
  list: (b) => {
    const items = b.items
      .map((i) => `<li style="margin:0 0 8px;">${esc(i.main)}${i.note ? `<br /><span style="color:#666666;font-size:13px;">${esc(i.note)}</span>` : ''}</li>`)
      .join('');
    return `<ul style="margin:0 0 16px;padding-left:20px;">${items}</ul>`;
  },
  link: (b) => `<p style="${TEXT_STYLE}"><a href="${esc(b.url)}" style="${BUTTON_STYLE}">${esc(b.label)}</a></p>`
};

const TEXT_BLOCK: { [K in Block['kind']]: (block: Extract<Block, { kind: K }>) => string } = {
  paragraph: (b) => b.text,
  list: (b) => b.items.map((i) => `- ${i.main}${i.note ? `\n  ${i.note}` : ''}`).join('\n'),
  link: (b) => `${b.label}: ${b.url}`
};

function renderBlock<R>(table: { [K in Block['kind']]: (block: Extract<Block, { kind: K }>) => R }, block: Block): R {
  return (table[block.kind] as (b: Block) => R)(block);
}

function toHtml(content: Content): string {
  const body = content.blocks.map((b) => renderBlock(HTML_BLOCK, b)).join('\n');
  const footer = `You get this because ${esc(content.reason)}. <a href="${MANAGE_URL}" style="color:#666666;">Manage email categories</a>.`;

  return [
    '<!doctype html>',
    '<html><body style="margin:0;padding:0;background:#ffffff;">',
    '<div style="max-width:560px;margin:0 auto;padding:24px 16px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#111111;">',
    `<p style="margin:0 0 24px;"><img src="${LOGO_URL}" width="${LOGO_SIZE_PX}" height="${LOGO_SIZE_PX}" alt="Feega" style="display:block;border:0;" /></p>`,
    body,
    `<p style="margin:32px 0 0;font-size:13px;line-height:1.5;color:#666666;">${footer}</p>`,
    '</div>',
    '</body></html>'
  ].join('\n');
}

function toText(content: Content): string {
  const body = content.blocks.map((b) => renderBlock(TEXT_BLOCK, b)).join('\n\n');
  const footer = `You get this because ${content.reason}. Manage email categories: ${MANAGE_URL}`;

  return `${body}\n\n--\n${footer}\n`;
}

export function renderEmail<K extends EmailKind>(kind: K, data: EmailData[K]): RenderedEmail {
  const content = CONTENT[kind](data);

  return { subject: oneLine(content.subject), html: toHtml(content), text: toText(content) };
}
