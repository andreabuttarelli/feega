# Cattura nel browser più veloce: niente attese di paint, più corsie

Dopo #197 il render nel browser era 3–5× il farm sul 2D. Misurato per frame (Chromium headless,
1080p30): sul 2D ~92 ms, di cui ~60 ms erano quattro `requestAnimationFrame` di attesa (`painted`
prima e dopo i video) e ~30 ms html-to-image.

## Cosa cambia

- **`Settle.Seek`** (`capture.ts`): dopo il seek il DOM e i canvas sono già aggiornati in modo
  sincrono (i componenti disegnano su `hf-seek`, i renderer WebGL hanno `preserveDrawingBuffer`),
  quindi non si aspetta il paint; si aspetta un frame solo se la pagina ha dei `<video>`.
  `Settle.Paint` resta per il profilo `exact`.
- **Corsie** (`export/lanes.ts`, `hyperframes/capture-player.ts`): fino a 4 player nascosti dietro
  quello visibile, ognuno con il suo iframe, catturano frame alterni; `shootInLanes` li riconsegna
  in ordine all'encoder con al massimo 2 frame in attesa per corsia (niente buffer illimitati, il
  crash di #89). Corsie per dispositivo in `LANES_OF`: desktop metà dei core fino a 4, telefono 2,
  telefono debole 1.
- **Profilo** (`export/capture-profile.ts`): `fast` (default) e `exact` (paint + 1 corsia).
  `/render/{token}?capture=exact` lo forza.

## Verifica

`tests/e2e/render-parity.spec.ts` (@real, in locale): flat, 3 matte, Text3D, particelle rese con
`exact` e con `fast`, PSNR medio ffmpeg ≥ 40 dB. Verde.

## Tempi (Chromium headless locale, 1080p30)

| caso | prima | dopo | farm |
|---|---|---|---|
| 2D 30 s (900 frame) | 83 s | 27 s | 16 s misurato (bench 05/10) |
| 3 matte, 270 frame | 62 s | 59 s | ~115 s stimato da `estimatedUsage` |
| Text3D, 120 frame | 39 s | 33 s | 38 s misurato |

## Scartato / non fatto

- Le corsie non aiutano le matte: gli iframe sandbox stanno nello stesso processo renderer, e il
  costo della matte è html-to-image che serializza le maschere SVG sul thread principale.
- Cattura diretta `drawImage` dei canvas WebGL/particelle/video invece di html-to-image: non fatta.
  Il 3D è già sotto il farm; comporre i canvas sopra lo snapshot DOM richiede di provare
  z-order, trasformazioni e opacità degli antenati, e un errore lì è un frame sbagliato in silenzio.
- Riuso del DOM fra frame: html-to-image clona a ogni frame; i font invece erano già serializzati
  una volta sola (`fonts ??=`).
- Headless usa SwiftShader: su una GPU vera il 3D nel browser dovrebbe andare meglio, non misurato.
