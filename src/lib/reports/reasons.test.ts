import { describe, expect, it } from 'vitest';
import { COUNTER_NOTICE_FIELDS, REPORT_REASONS, ReportReason, validateFields, validateReport } from './reasons';

const URL_FIELD = { url: 'https://feega.app/s/tok' };

const illegal = {
  ...URL_FIELD,
  category: 'fraud',
  explanation: 'This promotes a scam.',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  good_faith: 'on'
};

const copyright = {
  ...URL_FIELD,
  work: 'My photo "Sunset", published at https://ada.example/sunset',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  address: '1 Analytical St, London',
  good_faith: 'on',
  accuracy: 'on',
  signature: 'Ada Lovelace'
};

describe('the reason table', () => {
  it('lists the four reasons, CSAM first by priority', () => {
    const byPriority = [...REPORT_REASONS].sort((a, b) => a.priority - b.priority).map((r) => r.id);
    expect(byPriority[0]).toBe(ReportReason.Csam);
    expect(byPriority).toHaveLength(4);
  });

  it('only CSAM lets the reporter stay anonymous', () => {
    const anonymous = REPORT_REASONS.filter((r) => !r.fields.some((f) => f.name === 'email' && f.required)).map((r) => r.id);
    expect(anonymous).toEqual([ReportReason.Csam]);
  });

  it('CSAM escalates on every report', () => {
    const csam = REPORT_REASONS.find((r) => r.id === ReportReason.Csam)!;
    expect(csam.escalates({})).toBe(true);
  });

  it('illegal content escalates only for a threat to life', () => {
    const reason = REPORT_REASONS.find((r) => r.id === ReportReason.Illegal)!;
    expect(reason.escalates({ category: 'threat_to_life' })).toBe(true);
    expect(reason.escalates({ category: 'fraud' })).toBe(false);
  });
});

describe('validateReport', () => {
  it('accepts a complete DSA notice', () => {
    const result = validateReport(ReportReason.Illegal, illegal);
    expect(result.ok).toBe(true);
  });

  it('a DSA notice without the good-faith statement is refused', () => {
    const result = validateReport(ReportReason.Illegal, { ...illegal, good_faith: '' });
    expect(result).toMatchObject({ ok: false, errors: { good_faith: expect.any(String) } });
  });

  it('a DSA notice needs name and email', () => {
    const result = validateReport(ReportReason.Illegal, { ...illegal, name: '', email: 'nope' });
    expect(result).toMatchObject({ ok: false, errors: { name: expect.any(String), email: expect.any(String) } });
  });

  it('accepts a DMCA notice with every §512(c)(3) element', () => {
    expect(validateReport(ReportReason.Copyright, copyright).ok).toBe(true);
  });

  it('a DMCA notice without the perjury statement or the signature is refused', () => {
    const result = validateReport(ReportReason.Copyright, { ...copyright, accuracy: '', signature: '' });
    expect(result).toMatchObject({ ok: false, errors: { accuracy: expect.any(String), signature: expect.any(String) } });
  });

  it('a DMCA notice must identify the work', () => {
    const result = validateReport(ReportReason.Copyright, { ...copyright, work: '' });
    expect(result).toMatchObject({ ok: false, errors: { work: expect.any(String) } });
  });

  it('a likeness report needs who is depicted', () => {
    const result = validateReport(ReportReason.Likeness, { ...URL_FIELD, explanation: 'my face', name: 'Ada', email: 'ada@example.com', good_faith: 'on', relation: '' });
    expect(result).toMatchObject({ ok: false, errors: { relation: expect.any(String) } });
  });

  it('a CSAM report needs only the location', () => {
    expect(validateReport(ReportReason.Csam, URL_FIELD).ok).toBe(true);
  });

  it('every report needs a location', () => {
    expect(validateReport(ReportReason.Csam, { url: '' })).toMatchObject({ ok: false, errors: { url: expect.any(String) } });
  });

  it('an option outside the list is refused', () => {
    const result = validateReport(ReportReason.Illegal, { ...illegal, category: 'made-up' });
    expect(result).toMatchObject({ ok: false, errors: { category: expect.any(String) } });
  });

  it('keeps only the fields of the chosen reason, trimmed', () => {
    const result = validateReport(ReportReason.Csam, { ...URL_FIELD, explanation: '  seen  ', signature: 'x' });
    expect(result).toEqual({ ok: true, value: { url: 'https://feega.app/s/tok', explanation: 'seen' } });
  });

  it('an unknown reason is refused', () => {
    expect(validateReport('spam', URL_FIELD)).toMatchObject({ ok: false, errors: { reason: expect.any(String) } });
  });
});

describe('the DMCA counter-notice', () => {
  const counter = {
    name: 'Bob Rossi',
    email: 'bob@example.com',
    address: 'Via Roma 1, Rome',
    material: 'My image node at https://feega.app/s/tok',
    statement: 'It is my own photo.',
    perjury: 'on',
    consent: 'on',
    signature: 'Bob Rossi'
  };

  it('accepts every §512(g)(3) element', () => {
    expect(validateFields(COUNTER_NOTICE_FIELDS, counter).ok).toBe(true);
  });

  it('refuses it without the perjury statement or the consent to jurisdiction', () => {
    const result = validateFields(COUNTER_NOTICE_FIELDS, { ...counter, perjury: '', consent: '' });
    expect(result).toMatchObject({ ok: false, errors: { perjury: expect.any(String), consent: expect.any(String) } });
  });
});
