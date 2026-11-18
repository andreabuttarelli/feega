import { describe, expect, it } from 'vitest';
import { LiveProp } from '$lib/canvas/live-fields';
import { liveTheme, tokenFor } from './live-tokens';

const APP_CSS = `@import 'tailwindcss';

@theme {
  --color-primary: #1d3557;
  --color-accent: oklch(0.7 0.2 30);
  --radius-card: 14px;
  --text-display: 56px;
}
`;

const read = async (path: string) => ({ 'src/app.css': APP_CSS })[path as 'src/app.css'] ?? null;

describe('tokenFor', () => {
  it('un colore del tema diventa il suo nome', async () => {
    const theme = await liveTheme(read);
    expect(tokenFor(LiveProp.Color, 'rgb(29, 53, 87)', theme)).toBe('primary');
  });

  it('un colore fuori tema diventa un valore arbitrario', async () => {
    const theme = await liveTheme(read);
    expect(tokenFor(LiveProp.Fill, '#FF3B30', theme)).toBe('[#ff3b30]');
  });

  it('lo spazio multiplo della base diventa un passo della scala', async () => {
    const theme = await liveTheme(read);
    expect(tokenFor(LiveProp.Padding, '24px', theme)).toBe('6');
    expect(tokenFor(LiveProp.Gap, '18px', theme)).toBe('[18px]');
  });

  it('raggio e dimensione del testo cercano i token, poi la scala', async () => {
    const theme = await liveTheme(read);
    expect(tokenFor(LiveProp.Radius, '14px', theme)).toBe('card');
    expect(tokenFor(LiveProp.Radius, '9999px', theme)).toBe('full');
    expect(tokenFor(LiveProp.FontSize, '56px', theme)).toBe('display');
    expect(tokenFor(LiveProp.FontSize, '48px', theme)).toBe('5xl');
  });

  it('il peso numerico diventa il nome', async () => {
    const theme = await liveTheme(read);
    expect(tokenFor(LiveProp.FontWeight, '600', theme)).toBe('semibold');
  });

  it('su una pagina con la radice a 19px, 16px non è il passo 4 e 19px sì', async () => {
    const theme = await liveTheme(read, 19);
    expect(tokenFor(LiveProp.Padding, '16px', theme)).toBe('[16px]');
    expect(tokenFor(LiveProp.Padding, '19px', theme)).toBe('4');
    expect(tokenFor(LiveProp.FontSize, '21.375px', theme)).toBe('lg');
    expect(tokenFor(LiveProp.FontSize, '18px', theme)).toBe('[18px]');
  });
});
