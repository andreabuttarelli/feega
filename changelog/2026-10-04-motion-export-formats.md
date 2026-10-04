# Motion editor: formati di export sul server

Prima il render server usciva solo MP4 H.264. Ora l'azione `render` riceve `settings`
(`{ format, fps, quality }`, `export-formats.ts`) e il dialog ha quattro preset (Social MP4
1080p30, Master ProRes 4444, Web WebM trasparente, GIF) più i singoli controlli.

**Un master, poi una rifinitura.** Ogni formato è una riga di due tabelle: `FORMAT`
(estensione, MIME, tipo di asset, alpha, audio, master) e `FINISH` in `render-commands.ts`
(gli argomenti ffmpeg sul worker di testa). I blocchi rendono uno di quattro master che il
producer distribuito sa fare: H.264, H.265 (`codec: h265`), ProRes 4444 (`mov`), VP9 con alpha
(`webm`). La testa li unisce con il concat demuxer e:

- MP4 H.264: copia + `+faststart`; H.265: copia + `-tag:v hvc1` (Apple non apre `hev1`).
- ProRes 4444: copia, PCM; ProRes 422 HQ: ri-codifica dal 4444 (`prores_ks -profile:v 3`,
  `yuv422p10le`) — il producer fa solo 4444.
- WebM: copia, audio Opus.
- GIF: dal master VP9 decodificato con `libvpx-vp9` (il decoder nativo butta l'alpha), 15 fps,
  max 640 px, `palettegen`/`paletteuse` con trasparenza; massimo 15 s.
- PNG: dal master ProRes 4444, `frame_%05d.png` RGBA 8 bit in una cartella, poi `zip` (aggiunto
  all'apt della base: revisione 2).

Scartato: GIF e PNG dal producer (`gif` non è distribuito, `png-sequence` produce una cartella per
blocco con numerazioni da ricucire). H.265 su un render intero (25/50 fps) è rifiutato: il render
in-process non ha `codec`.

**Sfondo trasparente.** `doc.background` (`brand` | `transparent`, default `brand`): trasparente
toglie il colore di `#root` e le clip `BrandBackground`, così ProRes 4444/WebM/GIF/PNG hanno
alpha vero. Agente: `set_canvas { background }`.

**Il limite di Storage è 50 MB per file** (provato: 60 MB → `413 EntityTooLarge` sul progetto).
La dimensione dipende dal contenuto (ProRes 4444 di 4 s di grafica piatta: 8 MB contro 165 MB
nominali), quindi non si rifiuta in anticipo su una stima: il file oltre il limite fa fallire il
giro con `too_large: …` e niente addebito. Il dialog mostra la stima nominale come tetto. Per
master ProRes lunghi va alzato il limite globale di Storage del progetto.

**Marcatura AI.** `saveExport` marca per MIME: MP4/MOV/WebM con i tag ffmpeg di
`content-credentials.ts`; GIF e ZIP non hanno una strategia e restano non marcati (`ai_marked`
false), loggato.

Prova su Vercel Sandbox (4 s, 1080p30): ProRes 4444 `ap4h` `yuva444p12le` 8.6 MB 31 s; 422 HQ
`apch` `yuv422p10le` 5.5 MB 36 s; HEVC `hvc1` 0.4 MB 28 s; WebM VP9 `ALPHA_MODE=1` 0.6 MB; GIF
640×360 15 fps `bgra` 82 KB 31 s; PNG 120 file 1920×1080 RGBA 36 s.
