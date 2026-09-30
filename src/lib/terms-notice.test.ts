import { describe, expect, it } from 'vitest';
import { outdatedTermsVersion } from '$lib/terms-notice';
import { CURRENT_TERMS_VERSION } from '$lib/legal-links';

describe('quando mostrare la notizia di termini aggiornati', () => {
  it('nessuna notizia se il profilo è alla versione corrente', () => {
    expect(outdatedTermsVersion(CURRENT_TERMS_VERSION)).toBeNull();
  });

  it('notizia se il profilo è a una versione precedente', () => {
    expect(outdatedTermsVersion('2020-01-01')).toBe(CURRENT_TERMS_VERSION);
  });

  it('notizia anche senza accettazione registrata (account precedente alla colonna)', () => {
    expect(outdatedTermsVersion(null)).toBe(CURRENT_TERMS_VERSION);
  });
});
