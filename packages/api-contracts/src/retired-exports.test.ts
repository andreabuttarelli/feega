import { describe, it, expect } from 'vitest';
import * as contracts from './index';

/**
 * QUELLI CHE NON CI SONO PIÙ, DEL TUTTO.
 *
 * `studio`, il piano editoriale, il piano settimanale, `memory`, blog/autoblog e `captions/generate`
 * sono cancellati insieme al resto del prodotto vecchio: nessuna rotta REST li usa più, quindi
 * nessuno di questi contratti resta esportato.
 */
const GONE = [
  'ADD_COMPETITOR',
  'DELETE_COMPETITOR',
  'DELETE_PRODUCT',
  'DISCARD_PLAN',
  'RECORD_MEMORY_USED',
  'REMOVE_BLOG_TERM',
  'GENERATE_ARTICLE',
  'OPTIMIZE_ARTICLE',
  'GENERATE_CAPTIONS',
  'PROPOSE_PLAN',
  'REVISE_PLAN',
  'PLAN_WEEK',
  'REPLAN_WEEK',
  'RENDER_POST',
  'GENERATE_IMAGE',
  'GENERATE_VIDEO',
  'GENERATE_CAROUSEL',
  'REFINE_MEDIA',
  'GENERATE_MEDIA',
  'CHECK_MEDIA_JOB_READ',
  'MAX_MEDIA_ALTERNATIVES',
  'GET_ADS',
  'ADS_ACTION',
  'ADS_REMIX'
] as const;

describe('i contratti delle rotte cancellate', () => {
  it.each(GONE)('%s non è più esportato: nessuna rotta lo usa', (name) => {
    expect(contracts).not.toHaveProperty(name);
  });
});
