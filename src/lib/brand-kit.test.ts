import { describe, expect, it } from 'vitest';
import { kitFromForm, kitToForm, setLogoVariant, fontsFromForm } from './brand-kit';

const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};

describe('kitFromForm', () => {
  it('reads one swatch per line, hex first, optional name, and one rule per line', () => {
    const kit = kitFromForm(form({ palette: '#1a2b3c Ink\n\n#FFFFFF', tone: ' Warm ', do: 'Short\nPlain', dont: 'Puns' }));
    expect(kit).toEqual({
      ok: true,
      palette: [{ hex: '#1A2B3C', name: 'Ink' }, { hex: '#FFFFFF' }],
      voice: { tone: 'Warm', do: ['Short', 'Plain'], dont: ['Puns'] }
    });
  });

  it('refuses a line that is not a hex colour, naming it', () => {
    expect(kitFromForm(form({ palette: 'blue' }))).toEqual({ ok: false, error: 'Not a colour: blue' });
  });

  it('round-trips through kitToForm', () => {
    const fields = kitToForm({ palette: [{ hex: '#1A2B3C', name: 'Ink' }], voice: { tone: 'Warm', do: ['Short'] } });
    expect(fields).toEqual({ palette: '#1A2B3C Ink', tone: 'Warm', do: 'Short', dont: '' });
  });
});

describe('setLogoVariant', () => {
  it('replaces the variant in place and keeps the others', () => {
    const logos = [{ variant: 'primary' as const, url: 'https://x/p.png' }, { variant: 'dark' as const, url: 'https://x/d1.png' }];
    expect(setLogoVariant(logos, 'dark', 'https://x/d2.png')).toEqual([{ variant: 'primary', url: 'https://x/p.png' }, { variant: 'dark', url: 'https://x/d2.png' }]);
    expect(setLogoVariant(logos, 'dark', null)).toEqual([{ variant: 'primary', url: 'https://x/p.png' }]);
    expect(setLogoVariant([], 'mark', 'https://x/m.png')).toEqual([{ variant: 'mark', url: 'https://x/m.png' }]);
  });
});

describe('fontsFromForm', () => {
  it('an uploaded org font wins over a Google family; an empty role is cleared', () => {
    expect(fontsFromForm(form({ font_heading: 'Inter', org_font_heading: 'f1', font_body: 'Lora', org_font_body: '', font_accent: '' }))).toEqual([
      { role: 'heading', org_font_id: 'f1', google_family: null },
      { role: 'body', org_font_id: null, google_family: 'Lora' },
      { role: 'accent', org_font_id: null, google_family: null }
    ]);
  });
});
