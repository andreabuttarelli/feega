# Motion editor: durata per piano

Prima ogni video durava al massimo 60 s. Ora il doc accetta fino a 180 s (`MAX_SECONDS`, il
massimo della tabella) e il render server rifiuta, prima di creare il giro, un video più lungo di
quanto il piano renda: `RENDER_SECONDS` in `render-length.ts` (free/Go 60 s, Starter 120 s,
Pro/Scale 180 s), una riga per piano.

Il piano arriva come `RenderScope.plan`. Oggi l'org non ha una colonna piano
(`orgPlanForBrand` restituisce sempre null), quindi l'azione dell'editor non lo passa e ogni
render vale 60 s: il giorno che il piano dell'org esiste, basta passarlo lì. Un render lungo deve
comunque stare nei 300 s della funzione: 180 s a 1080p30 a blocchi ci sta, con blur no
(`BLUR_BUDGET`).
