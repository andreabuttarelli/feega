# Motion editor: tipografia ricca e fit misurato

Richiesta: tracking, interlinea, peso e assi dei font variabili su Title, Text, Kicker e
Caption, tutti animabili; il fit del testo misurato invece che stimato.

**Prop.** `tracking` (em), `leading`, `weight` (fino a 1000), `stretch` (asse `wdth`), `slant`
(asse `slnt`), `axes` (altri assi, stringa validata `'TAG' n, …`). I default rifanno il look di
prima (Title -0.045/0.95, Text -0.01/1.3, Kicker 0.02, Caption 1.25). Peso, tracking, leading,
stretch e slant sono `AnimProp` numeriche `Source.Prop`: keyframe ed espressioni passano dalla
stessa corsia delle prop colore, una variabile CSS su `#ks` che lo stile legge
(`calc(var(--kc-tracking) * 1em)`). Lo stile del testo vive in un posto solo,
`hyperframes/type-style.ts`.

**Font variabili.** Il catalogo ora porta gli assi (`a: [tag, min, max]`); una famiglia con asse
`wght` si chiede a Google con gli intervalli (`opsz,wght@14..32,100..900`), così un peso animato
scorre invece di saltare fra file statici. Il catalogo includeva solo i font non «brand» di
Google, e quindi perdeva Roboto, Roboto Flex e altri 220 open source: ora 1950 famiglie.

**Fit misurato.** `fit.ts` stimava la larghezza con `GLYPH_EM = 0.55`; ora ogni testo porta
`data-fit` con la misura chiesta e `FIT_TEXT` (in `__fontsReady`, dopo i font e dopo il parse del
DOM) la riduce del 5% finché il testo non sta nella sua `.box`. Due trappole trovate nel browser:
il testo dentro un clip nascosto (`display:none` finché il runtime non lo mostra) misura zero,
quindi gli antenati nascosti vengono mostrati per la misura e ripristinati; e un testo nascosto
non chiede il suo font, quindi anche le facce built-in (DM Sans, Fragment Mono) si caricano con
`document.fonts.load` prima della misura. Il fit si fa una volta, ai valori di partenza: un
tracking animato può uscire dalla box, ed è voluto.
