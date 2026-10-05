import { UPLOAD_MAX_BYTES, uploadKindOf } from '$lib/canvas/upload-kind';

export type PhotoFacts = { width: number; height: number; bytes: number; mimeType: string };

export enum QualityIssue {
  NotAPhoto = 'not_a_photo',
  TooHeavy = 'too_heavy',
  TooSmall = 'too_small',
  LowResolution = 'low_resolution',
  OddShape = 'odd_shape'
}

export enum Severity {
  Block = 'block',
  Warn = 'warn'
}

const MIN_EDGE_PX = 500;
const GOOD_EDGE_PX = 1000;
const MAX_RATIO = 2.5;

type QualityRule = { severity: Severity; problem: string; fix: string; fails: (photo: PhotoFacts) => boolean };

const shortEdge = (p: PhotoFacts) => Math.min(p.width, p.height);
const ratio = (p: PhotoFacts) => Math.max(p.width, p.height) / Math.max(shortEdge(p), 1);

export const QUALITY_RULES: Readonly<Record<QualityIssue, QualityRule>> = {
  [QualityIssue.NotAPhoto]: {
    severity: Severity.Block,
    problem: 'This file is not a photo.',
    fix: 'Use a JPG, PNG or WebP picture of your product.',
    fails: (p) => uploadKindOf(p.mimeType, '') !== 'image'
  },
  [QualityIssue.TooHeavy]: {
    severity: Severity.Block,
    problem: 'The photo is larger than 4 MB.',
    fix: 'Export it smaller, or send it as a JPG from your phone.',
    fails: (p) => p.bytes > UPLOAD_MAX_BYTES.image
  },
  [QualityIssue.TooSmall]: {
    severity: Severity.Block,
    problem: `The photo is too small (under ${MIN_EDGE_PX} px).`,
    fix: 'Take a new photo, closer to the product, or use the original file.',
    fails: (p) => shortEdge(p) < MIN_EDGE_PX
  },
  [QualityIssue.LowResolution]: {
    severity: Severity.Warn,
    problem: 'Low resolution: fine details may come out soft.',
    fix: `For sharp results use a photo of at least ${GOOD_EDGE_PX} px per side.`,
    fails: (p) => shortEdge(p) >= MIN_EDGE_PX && shortEdge(p) < GOOD_EDGE_PX
  },
  [QualityIssue.OddShape]: {
    severity: Severity.Warn,
    problem: 'The photo is very wide or very tall.',
    fix: 'Crop it closer to the product for a better result.',
    fails: (p) => ratio(p) > MAX_RATIO
  }
};

export type QualityNote = { id: QualityIssue; severity: Severity; problem: string; fix: string };

export type QualityVerdict = { ok: boolean; issues: QualityNote[] };

export function photoQuality(photo: PhotoFacts): QualityVerdict {
  const issues = (Object.entries(QUALITY_RULES) as [QualityIssue, QualityRule][])
    .filter(([, rule]) => rule.fails(photo))
    .map(([id, rule]) => ({ id, severity: rule.severity, problem: rule.problem, fix: rule.fix }));
  return { ok: !issues.some((i) => i.severity === Severity.Block), issues };
}
