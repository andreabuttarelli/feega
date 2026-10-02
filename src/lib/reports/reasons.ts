export enum ReportReason {
  Illegal = 'illegal',
  Copyright = 'copyright',
  Likeness = 'likeness',
  Csam = 'csam'
}

export type FieldKind = 'url' | 'text' | 'textarea' | 'email' | 'select' | 'statement';

export type ReportField = {
  name: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  options?: readonly { value: string; label: string }[];
};

export type ReportDetails = Record<string, string>;

export type ReasonSpec = {
  id: ReportReason;
  label: string;
  hint: string;
  priority: number;
  legalBasis: string;
  fields: readonly ReportField[];
  escalates: (details: ReportDetails) => boolean;
};

const MAX_LENGTH = 5000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const URL_FIELD: ReportField = { name: 'url', label: 'Link or location of the content', kind: 'url', required: true };
const NAME: ReportField = { name: 'name', label: 'Your full name', kind: 'text', required: true };
const EMAIL_FIELD: ReportField = { name: 'email', label: 'Your email', kind: 'email', required: true };

const ILLEGAL_CATEGORIES = [
  { value: 'threat_to_life', label: 'Threat to life or safety' },
  { value: 'terrorism', label: 'Terrorist content' },
  { value: 'hate', label: 'Illegal hate speech' },
  { value: 'fraud', label: 'Fraud or scam' },
  { value: 'privacy', label: 'Privacy violation or non-consensual intimate imagery' },
  { value: 'other', label: 'Other illegal content' }
] as const;

const LIKENESS_RELATIONS = [
  { value: 'self', label: 'It depicts me' },
  { value: 'representative', label: 'I represent the person depicted' }
] as const;

export const REPORT_REASONS: readonly ReasonSpec[] = [
  {
    id: ReportReason.Csam,
    label: 'Child sexual abuse material',
    hint: 'You do not need to give your name. We act immediately and report to the authorities.',
    priority: 0,
    legalBasis: 'Directive 2011/93/EU; Regulation (EU) 2022/2065 art. 18',
    fields: [
      URL_FIELD,
      { name: 'explanation', label: 'What you saw (optional)', kind: 'textarea', required: false },
      { name: 'email', label: 'Your email, if you want a reply (optional)', kind: 'email', required: false }
    ],
    escalates: () => true
  },
  {
    id: ReportReason.Illegal,
    label: 'Illegal content',
    hint: 'A notice under art. 16 of the EU Digital Services Act.',
    priority: 1,
    legalBasis: 'Regulation (EU) 2022/2065 art. 16',
    fields: [
      URL_FIELD,
      { name: 'category', label: 'Type of illegal content', kind: 'select', required: true, options: ILLEGAL_CATEGORIES },
      { name: 'explanation', label: 'Why you believe it is illegal', kind: 'textarea', required: true },
      NAME,
      EMAIL_FIELD,
      {
        name: 'good_faith',
        label: 'I confirm in good faith that the information and allegations in this notice are accurate and complete.',
        kind: 'statement',
        required: true
      }
    ],
    escalates: (details) => details.category === 'threat_to_life'
  },
  {
    id: ReportReason.Likeness,
    label: 'My likeness or voice used without consent',
    hint: 'Content that reproduces your face, body, voice or name.',
    priority: 2,
    legalBasis: 'Terms §11; Regulation (EU) 2016/679 art. 17',
    fields: [
      URL_FIELD,
      { name: 'relation', label: 'Who is depicted', kind: 'select', required: true, options: LIKENESS_RELATIONS },
      { name: 'explanation', label: 'What in the content is you, and how we can verify it', kind: 'textarea', required: true },
      NAME,
      EMAIL_FIELD,
      {
        name: 'good_faith',
        label: 'I confirm in good faith that the information in this report is accurate and that I did not consent to this use.',
        kind: 'statement',
        required: true
      }
    ],
    escalates: () => false
  },
  {
    id: ReportReason.Copyright,
    label: 'Copyright infringement (DMCA)',
    hint: 'A notice under 17 U.S.C. §512(c)(3). False claims can make you liable for damages.',
    priority: 3,
    legalBasis: '17 U.S.C. §512(c)(3); Directive 2001/29/EC',
    fields: [
      URL_FIELD,
      { name: 'work', label: 'The copyrighted work you claim is infringed', kind: 'textarea', required: true },
      { name: 'explanation', label: 'Anything else that helps us find the material (optional)', kind: 'textarea', required: false },
      NAME,
      EMAIL_FIELD,
      { name: 'address', label: 'Postal address', kind: 'text', required: true },
      { name: 'phone', label: 'Phone (optional)', kind: 'text', required: false },
      {
        name: 'good_faith',
        label: 'I have a good faith belief that the use of the material is not authorized by the copyright owner, its agent, or the law.',
        kind: 'statement',
        required: true
      },
      {
        name: 'accuracy',
        label: 'The information in this notice is accurate, and under penalty of perjury, I am the owner, or authorized to act on behalf of the owner, of an exclusive right that is allegedly infringed.',
        kind: 'statement',
        required: true
      },
      { name: 'signature', label: 'Electronic signature (type your full name)', kind: 'text', required: true }
    ],
    escalates: () => false
  }
];

export function reasonOf(id: string): ReasonSpec | null {
  return REPORT_REASONS.find((r) => r.id === id) ?? null;
}

export type Validation = { ok: true; value: ReportDetails } | { ok: false; errors: Record<string, string> };

const STATEMENT_CHECKED = 'on';

const valid = (ok: boolean, message: string): string | null => (ok ? null : message);

const KIND_CHECK: Record<FieldKind, (value: string) => string | null> = {
  url: (v) => valid(/^https?:\/\//i.test(v), 'Not a valid link'),
  email: (v) => valid(EMAIL.test(v), 'Not a valid email'),
  statement: (v) => valid(v === STATEMENT_CHECKED, 'Required'),
  text: () => null,
  textarea: () => null,
  select: () => null
};

function fieldError(field: ReportField, value: string): string | null {
  if (!value) {
    return field.required ? 'Required' : null;
  }
  if (value.length > MAX_LENGTH) {
    return 'Too long';
  }
  if (field.options && !field.options.some((o) => o.value === value)) {
    return 'Choose one of the options';
  }
  return KIND_CHECK[field.kind](value);
}

export function validateFields(fields: readonly ReportField[], input: Record<string, string | undefined>): Validation {
  const value: ReportDetails = {};
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const raw = (input[field.name] ?? '').trim();
    const error = fieldError(field, raw);
    if (error) {
      errors[field.name] = error;
      continue;
    }
    if (raw) {
      value[field.name] = raw;
    }
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

export function validateReport(reasonId: string, input: Record<string, string | undefined>): Validation {
  const reason = reasonOf(reasonId);
  if (!reason) {
    return { ok: false, errors: { reason: 'Choose a reason' } };
  }
  return validateFields(reason.fields, input);
}

export const COUNTER_NOTICE_FIELDS: readonly ReportField[] = [
  NAME,
  EMAIL_FIELD,
  { name: 'address', label: 'Postal address', kind: 'text', required: true },
  { name: 'phone', label: 'Phone (optional)', kind: 'text', required: false },
  { name: 'material', label: 'The material that was removed and where it appeared', kind: 'textarea', required: true },
  { name: 'statement', label: 'Why the removal was a mistake or misidentification', kind: 'textarea', required: true },
  {
    name: 'perjury',
    label: 'I swear, under penalty of perjury, that I have a good faith belief that the material was removed or disabled as a result of mistake or misidentification of the material to be removed or disabled.',
    kind: 'statement',
    required: true
  },
  {
    name: 'consent',
    label: 'I consent to the jurisdiction of the Federal District Court for the judicial district in which my address is located (or, if outside the United States, any judicial district in which feega may be found), and I will accept service of process from the person who provided the notice or an agent of such person.',
    kind: 'statement',
    required: true
  },
  { name: 'signature', label: 'Electronic signature (type your full name)', kind: 'text', required: true }
];
