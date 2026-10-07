# Apple minimal vuol dire look minimale, energia alta

Prima: la riga `AppleMinimal` di `STYLES` chiedeva un video "calmo, lento": ingressi 0,6–1,2 s,
scene 2–4 s, push-in del 4%, al massimo due cose in movimento, nessuna camera nominata. I video
dub.co v3 e v4 uscivano puliti e statici: l'utente non li comprerebbe.

Ora la stessa riga (sempre l'unico posto) chiede il look di un film di lancio Apple/Linear/Vercel
con energia alta: scene 1–2,5 s tagliate sul beat, musica sempre presente, tipografia cinetica
(ingressi 0,3–0,8 s), ogni scena in movimento (push-in 12%, device 3D che girano fino a 30°,
camera), speed ramp, match cut, un picco wow a due terzi; vietati restano particelle, glow, testo
che ruota, bounce, wipe e push, più di tre cose in movimento. Le scene della libreria restano quelle di main
(testo che scatta in 0,3–0,5 s, immagini sempre in deriva). La giunzione `zoom` è ammessa come
punch sul beat. Il logo del brand resta l'asset originale, piatto e intatto (regola anche nel
critico Deep).

Il critico Deep giudica con una domanda sola, "un cliente lo pagherebbe?": un video pulito ma
statico vale al massimo 5/10.

Musica: `generate_music` usa ElevenLabs quando c'è; altrimenti `music-bed.ts` sintetizza da codice
una base CC0 (kick sul beat, rullante su 2 e 4, build fino al picco a due terzi, tempo letto dal
prompt), salvata come asset audio con la licenza in `assets.content`. Scartato: tracce CC0 da siti
terzi (link instabili, licenze da verificare una per una).
