import { reasonOf, ReportReason, type ReportDetails } from '$lib/reports/reasons';
import { DECISION_EFFECTS, type Decision, type Ground } from '$lib/reports/decisions';
import { Standing } from '$lib/reports/strikes';

export const REPORTS_CONTACT = 'support@feega.app';

export type ReportMailView = {
  id: string;
  reason: ReportReason;
  targetUrl: string;
  details: ReportDetails;
};

export type DecisionView = {
  decision: Decision;
  ground: Ground;
  note: string;
  standing: Standing;
};

export type CounterNoticeView = { name: string; address: string; statement: string };

export type Mail = { subject: string; text: string; html: string };

const STANDING_LINE: Record<Standing, string> = {
  [Standing.Good]: 'Your account remains in good standing.',
  [Standing.Warned]: 'This is a warning: further violations lead to suspension and then termination of your account.',
  [Standing.Suspended]: 'Your account is suspended because of repeated violations.',
  [Standing.Terminated]: 'Your account is terminated because of repeated or serious violations.'
};

const escape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function mail(subject: string, lines: string[]): Mail {
  const text = lines.join('\n\n');
  const html = lines.map((l) => `<p style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escape(l)}</p>`).join('');
  return { subject, text, html };
}

const reasonLabel = (r: ReportMailView): string => reasonOf(r.reason)?.label ?? r.reason;
const groundLine = (d: DecisionView): string => `Ground: ${d.ground.label} — ${d.ground.clause}`;
const decisionLabel = (d: DecisionView): string => DECISION_EFFECTS[d.decision].label;

export function receiptEmail(r: ReportMailView): Mail {
  return mail(`We received your report (case ${r.id})`, [
    'Thank you. We received your report and will review it without undue delay.',
    `Case: ${r.id}`,
    `Reason: ${reasonLabel(r)}`,
    `Content: ${r.targetUrl}`,
    `We will email you our decision. Questions: ${REPORTS_CONTACT}.`
  ]);
}

export function decisionEmail(r: ReportMailView, d: DecisionView): Mail {
  return mail(`Decision on your report (case ${r.id})`, [
    `We reviewed your report about ${r.targetUrl}.`,
    `Decision: ${decisionLabel(d)}`,
    groundLine(d),
    `If you disagree, reply to ${REPORTS_CONTACT} within six months to contest it. You may also use a certified out-of-court dispute settlement body or go to court.`
  ]);
}

function dmcaLines(r: ReportMailView, counterUrl: string): string[] {
  return [
    'The notice we received (17 U.S.C. §512(c)(3)):',
    `Claimant: ${r.details.name ?? ''} <${r.details.email ?? ''}>\nWork: ${r.details.work ?? ''}\nSignature: ${r.details.signature ?? ''}`,
    `If you believe the material was removed by mistake or misidentification, you can send a counter-notice: ${counterUrl}`,
    'We forward it to the claimant and restore the material 10 to 14 business days later, unless the claimant tells us they have filed a court action.'
  ];
}

export function statementOfReasons(r: ReportMailView, d: DecisionView, counterUrl: string | null): Mail {
  const dmca = counterUrl ? dmcaLines(r, counterUrl) : [];

  return mail(`Statement of reasons: action on your content (case ${r.id})`, [
    `Content: ${r.targetUrl}`,
    `What we did: ${decisionLabel(d)}`,
    `Facts and circumstances: a report for "${reasonLabel(r)}". ${d.note}`,
    groundLine(d),
    'Taken by a person, not by automated means; no automated system detected or decided this.',
    STANDING_LINE[d.standing],
    ...dmca,
    `How to contest: reply to ${REPORTS_CONTACT} within six months (internal complaint, DSA art. 20). You may also refer the decision to a certified out-of-court dispute settlement body (DSA art. 21) or bring it before a court.`
  ]);
}

export function counterForwardEmail(r: ReportMailView, c: CounterNoticeView, restoreAt: Date): Mail {
  return mail(`Counter-notice received (case ${r.id})`, [
    `The user whose material at ${r.targetUrl} was removed after your notice sent a counter-notice under 17 U.S.C. §512(g)(3).`,
    `Name: ${c.name}\nAddress: ${c.address}\nStatement: ${c.statement}`,
    `We will restore the material on ${restoreAt.toISOString().slice(0, 10)} unless, before then, you tell us at ${REPORTS_CONTACT} that you have filed a court action to restrain the user.`
  ]);
}

export function escalationEmail(r: ReportMailView, queueUrl: string): Mail {
  return mail(`URGENT: ${reasonLabel(r)} reported (case ${r.id})`, [
    'A report flagged for immediate escalation (DSA art. 18) has arrived.',
    `Reason: ${reasonLabel(r)}${r.details.category ? ` (${r.details.category})` : ''}`,
    `Content: ${r.targetUrl}`,
    `Queue: ${queueUrl}`,
    'Follow docs/legal/serious-crime-escalation.md: secure evidence, remove, notify the authorities.'
  ]);
}
