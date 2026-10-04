# Marchio feega nell'intestazione

**Perché.** `BrandMark.svelte` disegnava ancora le lettere di «dazero» ruotate; accanto alla
parola «feega» nell'intestazione della dashboard e dei docs il marchio era quello vecchio.

**Cosa.** Il marchio diventa il segno della favicon (`static/icon-192.png`): orizzonte con
la cupola e l'anello sotto, un solo tracciato a 24px, angoli squadrati.

**Indagato e non riprodotto su main** (dopo #105), con l'harness usa-e-getta: preview nera
al frame 0 (immagine, video e forma a frame 0 si vedono al caricamento e dopo uno scrub) e
spazio vuoto fra righello e prima traccia. Il nero visto prima veniva da un `BrandBackground`
(fill `#0a0a0a`) in una traccia sopra il footage: la traccia in alto copre quelle sotto.

# Tema chiaro/scuro per account

Selettore Sistema/Chiaro/Scuro (`ThemeSwitch`) nel menu account, nell'intestazione del motion
editor e in Impostazioni › Aspetto. La scelta va in `user_metadata.theme` (come il modello della
chat) e nel cookie `theme`; `hooks.server.ts` mette `data-theme` sull'`<html>` già nell'SSR
(dal cookie, o dai metadata alla prima richiesta dopo il login), quindi niente lampo. «Sistema»
si risolve prima del paint con uno script inline in `app.html` e segue il cambio dell'OS.
Verificati in scuro: dashboard, tela, motion editor, upscaler, compositions.
