import { describe, expect, it } from 'vitest';
import { ReportReason } from '$lib/reports/reasons';
import { Decision, groundOf } from '$lib/reports/decisions';
import { Standing } from '$lib/reports/strikes';
import {
  counterForwardEmail,
  decisionEmail,
  escalationEmail,
  receiptEmail,
  statementOfReasons
} from './report-emails';

const report = {
  id: 'r-1',
  reason: ReportReason.Copyright,
  targetUrl: 'https://feega.app/s/tok',
  details: { work: 'My photo "Sunset"', name: 'Ada <b>', email: 'ada@example.com', signature: 'Ada' }
};

const removal = {
  decision: Decision.Remove,
  ground: groundOf(Decision.Remove, 'copyright')!,
  note: 'Exact copy of the claimed photo.',
  standing: Standing.Warned
};

describe('report emails', () => {
  it('the receipt names the case and the reason', () => {
    const mail = receiptEmail(report);
    expect(mail.subject).toContain('r-1');
    expect(mail.text).toContain('Copyright infringement');
    expect(mail.text).toContain('https://feega.app/s/tok');
  });

  it('escapes what the reporter typed in the html part', () => {
    expect(receiptEmail({ ...report, targetUrl: 'https://x/<script>' }).html).not.toContain('<script>');
  });

  it('the decision to the reporter states the outcome and the ground', () => {
    const mail = decisionEmail(report, removal);
    expect(mail.text).toContain('Remove content');
    expect(mail.text).toContain('17 U.S.C. §512(c)');
  });

  it('the statement of reasons carries every DSA art. 17 element', () => {
    const mail = statementOfReasons(report, removal, null);
    expect(mail.text).toContain('What we did: Remove content');
    expect(mail.text).toContain('Exact copy of the claimed photo.');
    expect(mail.text).toContain('Ground: Copyright infringement — 17 U.S.C. §512(c)');
    expect(mail.text).toContain('Taken by a person, not by automated means');
    expect(mail.text).toContain('support@feega.app');
    expect(mail.text).toMatch(/out-of-court dispute settlement/);
    expect(mail.text).toMatch(/court/);
  });

  it('a DMCA removal forwards the notice and explains the counter-notice', () => {
    const mail = statementOfReasons(report, removal, 'https://feega.app/report/counter/r-1?t=abc');
    expect(mail.text).toContain('My photo "Sunset"');
    expect(mail.text).toContain('Ada <b>');
    expect(mail.text).toContain('https://feega.app/report/counter/r-1?t=abc');
    expect(mail.text).toMatch(/10 to 14 business days/);
  });

  it('the statement tells the user where their account stands', () => {
    expect(statementOfReasons(report, removal, null).text).toMatch(/warning/i);
  });

  it('the counter-notice is forwarded to the claimant with the restore date', () => {
    const mail = counterForwardEmail(report, { name: 'Bob', address: 'Rome', statement: 'mistake' }, new Date('2026-10-16T12:00:00Z'));
    expect(mail.text).toContain('Bob');
    expect(mail.text).toContain('2026-10-16');
  });

  it('the escalation says why it is urgent', () => {
    const mail = escalationEmail({ ...report, reason: ReportReason.Csam }, 'https://feega.app/admin/reports');
    expect(mail.subject).toMatch(/URGENT/);
    expect(mail.text).toContain('https://feega.app/admin/reports');
  });
});
