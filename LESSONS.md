# LESSONS

Lezioni imparate lavorando a questo repo: problemi veri, il segnale che li fa riconoscere, e la mossa che li risolve. Una sezione per tema. Una lezione nova entra qui nel commit che l'ha pagata.

## Ambiente e worktree

### Spostare nel DOM un nodo che contiene un iframe lo ricarica vuoto
Segnale: la preview motion montata altrove (dentro un nodo della tela) resta nera, la timeline
scorre, nessun errore in console. Mossa: non riparentare il player; ancorarlo sopra il bersaglio
con posizione calcolata a ogni frame (`anchoredTo` in `inline-stage.svelte.ts`). Un'asserzione
sui pixel accesi al centro del player (non sul riquadro intero: i bordi ingannano) lo prende.

### Un `vite dev` lasciato acceso serve moduli vecchi a Playwright
Segnale: un giro Playwright verde (o rosso) che non cambia dopo un edit; un `console.log` appena
aggiunto non compare; il CSS servito (`?svelte&type=style`) non contiene la regola nuova. Mossa:
riavviare il dev server della propria porta prima di ogni giro e2e che deve vedere un edit; un
verde ottenuto prima del riavvio non vale.

### Verde in locale, rosso in CI: una chiave del `.env` sceglie il ramo
Il `.env` copiato nel worktree porta chiavi (es. `EXA_API_KEY`) che la CI non ha: in locale il
codice prende un altro ramo e i mock del test non vengono mai toccati. Segnale: `No "X" export is
defined on the mock` solo in CI. Mossa: rilanciare il test con la variabile vuota
(`EXA_API_KEY= npx vitest run …`), e costruire i client dei provider al primo uso, non alla
creazione dei tool.

### I tempi di idratazione misurati in dev non dicono niente
In dev Vite serve centinaia di moduli non raggruppati e compila le pagine alla prima richiesta:
la tela «idrata» in secondi anche quando in produzione ci mette mezzo secondo, e un taglio di
100 KB non si vede. Segnale: numeri che cambiano del doppio fra due giri identici, e un `jsFiles`
nell'ordine delle centinaia. Mossa: `npx vite build` e `npx vite preview --port 4180` (mai sulla
5173 di chi lavora), poi Playwright con la cache disabilitata via CDP; per il dispositivo medio,
`Emulation.setCPUThrottlingRate` 4 e rete Fast 4G. L'idratazione si legge da un bottone che ha
i gestori di Svelte 5 (proprietà `Symbol` sull'elemento), non da `networkidle`. E una build in
background va interrogata a intervalli brevi: aspettarla ferma oltre dieci minuti fa uccidere la
sessione dal watchdog.

### Il worktree nuovo ha bisogno di `npm ci` — e ancora dopo ogni rebase su dev
Un worktree parte senza `node_modules`, e `vite.config.ts` muore subito (`Cannot find package '@sentry/sveltekit'`). Ma il caso insidioso è l'altro: dopo aver ribasato su dev che ha accolto PR nuove, il `node_modules` installato col vecchio lockfile produce guasti **deterministici e fuori posto** — v. `extractUserText is not a function` in un test di immagini: il codice era giusto, le dipendenze vecchie. Segnale: un errore `X is not a function` su codice mai toccato, in un worktree ribasato. Mossa: `npm ci` nel worktree, sempre, dopo il rebase.

**E il worktree nuovo non ha nemmeno `.env`: `hooks.server.test.ts` fallisce da solo.** Con
`node_modules` a posto resta un rosso che sembra tuo: `TypeError: Invalid URL` all'import, un file
solo, in un test che la tua modifica non sfiora. Non è una regressione — è una variabile
d'ambiente che manca, e il checkout principale ce l'ha. Segnale: quel test è l'UNICO rosso su
~7.300 passati, e passa nel checkout principale. Mossa: rilancialo nel checkout principale prima
di indagare; se lì è verde, è l'ambiente, non il tuo diff. Ha già fatto perdere tempo a due
agenti lo stesso giorno.

**E prima di credere a un rosso locale, guarda la CI.** Lo stesso `extractUserText`/
`extractUserImages` è tornato il 4/9 su `dev`: quei simboli non erano codice nostro ma una patch
`patch-package`, tolta perché non applicava più alla versione installata. In locale i test
falliscono davvero; **sulla CI passano** (verificato nel log della run, non dedotto). Segnale: un
rosso locale su file che nessuna PR ha toccato, mentre la CI è verde. Mossa: leggere il log della
CI PRIMA di cancellare il test — il soggetto è vivo, è l'installazione locale a essere fuori
posto, e cancellarlo butta via copertura che funziona.

### Il worktree nuovo ha bisogno anche del `.env`
Dopo il `npm ci` la suite parte ma cade su 40+ test con `SUPABASE_SERVICE_ROLE_KEY not configured`: Vitest carica l'env dal `.env` del worktree, che non c'è. Segnale: errori di env mancante in un worktree fresco, deterministici, su file che passano nel checkout principale. Mossa: `cp ../dazero/.env .` alla creazione del worktree, accanto al `npm ci`.

### **Una regola di `.gitignore` senza `/` iniziale mangia una cartella di codice, in silenzio**
Rotta nuova in `src/routes/api/v1/brands/[slug]/evidence/artifacts/`, 27 test verdi, `git add -A`,
commit — e nel commit la cartella non c'era. La riga era `artifacts/`: senza `/` iniziale git la
applica a **ogni** livello, non solo alla radice, e `git add -A` non protesta per un file ignorato.
In produzione sarebbe stato un 404 su un endpoint che in locale passava tutti i test. Segnale: il
conto in `git show --stat` non torna con i file che hai scritto, e `git status` non mostra niente.
Mossa: dopo il commit, `git show --stat HEAD` e conta; se manca qualcosa,
`git check-ignore -v <path>` dice quale riga l'ha presa. La riga si ancora (`/artifacts/`), non si
aggira con `git add -f`: il `-f` vale per te oggi, l'ancora vale per tutti domani.

### **Il `.env` copiato può puntare al progetto hosted: il 404 sembrerà un bug di permessi**
worktree con `.env` copiato ma `PUBLIC_SUPABASE_URL` sul progetto remoto: il login va, il brand locale esiste, ma `/app/<brand>` rende 404 "Brand not found" e la diagnosi scarta su RLS. In più una chiave segnaposto (`LLM_API_KEY` con dentro una frase italiana) passa i check di configurazione e muore 401 alla prima chiamata. Mossa: prima di sospettare RLS, `grep PUBLIC_SUPABASE_URL .env` (deve essere `http://localhost:8000`) e guarda gli `ai_calls`: le righe ok=false con 401 valgono più di ogni grep sul codice.

### Un test che sceglie un ramo in base all'env locale non è un test
`queue-dm.test` girava o no il ramo kit secondo `AGENT_KIT` del `.env` locale: sul laptop di chi lo ha spento passava, su chi lo ha acceso il turno andava nel kit e `harnessCalls` restava vuoto (`expected +0 to be 1`). Segnale: un test che fallisce solo su un'altra macchina, senza cambiamento di codice. Mossa: chi fissa `$env/dynamic/private` nel test (`vi.mock('$env/dynamic/private', () => ({ env: { AGENT_KIT: 'off' } }))`), come già fa `queue-kit-heartbeat.test` — la scelta del ramo è parte del test, non del computer che lo esegue.

### CI `Build` fails with `Invalid export 'X' in /api/...`, while vitest and svelte-check are green
Signal: a `+server.ts` exports a constant (shared with its test). SvelteKit only allows handlers, `config`, `prerender`… or `_`-prefixed names, and only `vite build` checks it. Move: put the constant in the `$lib` module the route already imports, and run `npx vite build` before pushing a new route.

### Un test di checkout rosso solo in locale: l'URL di ritorno è `https://www.dazero.co/...`
Signal: `successUrl`/`cancelUrl` attesi su `example.test` o `feega.test`, ricevuti sull'host di `PUBLIC_APP_URL` del `.env`; in CI verde. `appOrigin` legge `$env/dynamic/public`. Move: nel test `vi.mock('$env/dynamic/public', () => ({ env: {} }))`, come in `settings-actions-billing.test.ts`.

### `@dazero/*` si risolve dal `node_modules` del checkout principale
Un eval o un test lanciato da un worktree misura un ibrido: `$lib` punta alla copia del worktree, i pacchetti interni vengono dal checkout madre. Se hai toccato `packages/`, il worktree non lo vede. Per un confronto pulito: worktree di verifica con `node_modules` symlinkato a quello fresco.

### Il worktree DENTRO la repo dir: la pagina è viva ma non risponde (403 su `entry.js`)
Un worktree creato dentro la cartella della repo (`dazero/dazero-wt/<slug>`) risolve `@sveltejs/kit` dal `node_modules` del checkout padre: vite lo serve via `/@fs/...` **fuori dalla root del worktree** e risponde 403 — il bundle client non parte, la hydratazione non arriva, e ogni click "riuscito" dell'automazione browser non cambia nulla (SSR morto senza errori in console). Segnale: `performance.getEntriesByType('resource')` mostra `entry.js` con `responseStatus: 403`, i click vanno a un DOM senza handler. Mossa: il worktree sta **fuori** dalla repo (`../dazero-wt/<slug>`, come da docs/e2e-testing.md §1) con `npm ci` proprio.

### Verifica il `workdir` prima di ogni Edit
Con più worktree aperti (feature + verifica), un edit fatto nel checkout sbagliato tocca dev. È successo: `live.ts` modificato nel checkout principale per un secondo, poi `git checkout --` e riapplicato nel posto giusto. Il tool Edit non ti proteggere — proteggiti tu: guarda il percorso del file che stai per toccare, sempre.

### Il `git stash` è condiviso fra tutti i worktree — ora è BLOCCATO da un hook
`git stash` legge e scrive lo STESSO ref (`refs/stash`) per l'intero repository, non per worktree: stashare dentro un worktree e fare `git stash pop` in un altro applica lì le modifiche del primo. È successo: `git stash` nella feature ha creato uno stash (e spinto via i miei edit di `live.ts`), e il `pop` eseguito dopo un timeout del tool di shell ha riesumato le modifiche di un ALTRO worktree (`video.ts`, irrelate) dentro il mio — lasciando il mio `live.ts` senza i miei edit. Segnale: dopo un `git stash`/`pop` i file modificati non corrispondono a quelli che avevi in mano, o compaiono modifiche a file mai toccati nel branch corrente. Mossa: evita `git stash` in un worktree — per sospendere delle modifiche usa il checkout dedicato (o `git diff > patch && git checkout --` e poi `git apply`), e se devi proprio stashare verifica sempre `git stash list` + `git show stash@{0} --stat` PRIMA del `pop`; un `pop` che finisce in timeout non è affidabile, riapri il file a mano e ricontrolla che i tuoi edit ci siano ancora.
**Aggiornamento (30/8): non è più una raccomandazione.** Un agente ha stashato di nuovo dentro un worktree, e questa volta è andata bene solo per fortuna. Un hook `PreToolUse` su Bash (`~/.claude/settings.json`) ora rifiuta ogni comando che invochi `git stash`, in qualunque posizione della riga, e spiega le alternative nel messaggio di rifiuto. La regola sta anche in CLAUDE.md e AGENTS.md.

### Un test verde sul checkout principale può essere rosso nel worktree: il `.env` locale entra nei test
`$env/dynamic/private` in vitest porta dentro il `.env` DELLA MACCHINA. Il checkout principale può passare per cache Vite stantia (env congelata prima di una variabile), il worktree con cache fresca fallisce — v. `queue-dm.test`: con `AGENT_KIT=on` locale il turno scappava nel ramo kit e il mock di `./subagents` moriva su `createSubagentTools`. Segnale: stesso codice, esito opposto fra checkout e worktree, e nessuna differenza nel diff. Mossa: il test che prova un percorso specifico fissa le variabili che gli servono spente (`vi.mock('$env/dynamic/private')` con override), non conta sul `.env` di chi lo lancia.

### **Una patch cambiata in un PR non si propaga ai worktree impilati con `npx patch-package`**
patch-package non aggiorna uno stato già patchato: dopo un merge/rebase che tocca `patches/`, i worktree impilati falliscono sui test del parser (es. pi-stream) anche se su dev passano, e patch-package muore con "cannot apply". Mossa: dopo ogni merge che cambia `patches/`, `npm ci` + `npx patch-package` in OGNI worktree impilato — il reinstall del solo pacchetto basta se sei sicuro del lockfile.

### Una sessione precedente uccisa lascia una `vite build` orfana che scrive nella STESSA `build/`
Una sessione (agente o terminale) chiusa a metà `npm run build` non porta via il processo: il trap del genitore non lo tocca, e `vite build` resta parente di `init`, vivo per decine di minuti, a scrivere in `build/`. Rilanciare il build nello stesso worktree fa gareggiare due `vite build` sulla stessa cartella d'output — corruzione silenziosa, non un errore chiaro. Segnale: `ps -ef | grep "vite build"` mostra più di un processo con lo stesso `cwd`, uno con `PPID 1` e un'ora di avvio molto più vecchia. Mossa: prima di rilanciare un build lungo in un worktree, cerca ed elimina (`kill -9`) ogni `vite build`/`npm run build` orfano di QUEL worktree — non toccare processi di altri worktree che condividono la macchina.

### `gh pr merge --delete-branch` sulla base di una pila chiude la PR figlia
Mergiando #133 con `--delete-branch`, GitHub ha cancellato `feat/editor-layout` e ha CHIUSO #135
(base `feat/editor-layout`) invece di ri-puntarla su `main`: va riaperta come PR nuova. Segnale:
la PR figlia passa a `CLOSED` senza merge appena la base viene mergiata. Mossa: merge della base
SENZA `--delete-branch`, poi `gh pr edit <figlia> --base main`, e cancella il branch solo dopo.

### Una PR «Merged» su GitHub può non essere MAI arrivata su `dev`
La #52 («Run custom-agent turns on the Agent Kit») risulta `MERGED` su GitHub, con tanto di merge commit, e il task su Notion diceva «In production». In produzione non c'è mai stata: era aperta **contro `feat/kit-private-threads`**, non contro `dev`, e quel branch intermedio in `dev` non è mai entrato. Il merge commit è reale e irraggiungibile — un ramo staccato che nessuno ha più tirato. Il codice su `dev` continuava a portare il gate vecchio (`!personaId`) mentre tutti lo davano per migrato.
Segnale: una feature che «è stata mergiata» ma il cui codice sul branch vivo non c'è — e `gh pr view` che mostra `baseRefName` diverso da `dev`/`main`. Il sospetto va acceso da `gh pr list --state merged` con un base branch che non è quello di destinazione: una PR impilata è mergiata nella sua pila, non nel prodotto.
Mossa, due comandi, prima di credere a «merged»:
```bash
gh pr view <n> --json baseRefName,mergeCommit
git merge-base --is-ancestor <merge-commit> origin/dev && echo LANDED || echo NEVER LANDED
```
Se la pila si abbandona, le PR che ci stavano sopra non si chiudono da sole: vanno riportate a mano sul branch di destinazione (cherry-pick del merge commit, che essendo squash ha un solo genitore), e la risoluzione dei conflitti è il prezzo di averlo scoperto tardi.

### Un difetto e la sua correzione nello stesso ramo sono una trappola armata
La #372 aveva cinque commit, e il terzo annullava una regressione introdotta dal secondo: una
dichiarazione di contenuto AI spenta senza volerlo (`content_type` che perde il prefisso
`uploaded`, e `publish.ts` che da quel prefisso ricava se dichiarare). Il merge è stato fatto **al
secondo commit**. Risultato: su `dev` è finito il difetto senza la correzione, e chi lo aveva
scritto lo dava per consegnato perché sul SUO ramo era a posto.

Non è un errore di verifica del merge — quello è il sintomo, ed è coperto dalla lezione qui sopra.
La causa è la **forma della consegna**: una PR non è un'unità atomica, e chi la scrive non decide
dove viene tagliata. Cinque commit sono cinque stati possibili del ramo base, e se il commit N
introduce un difetto che il commit N+2 ripara, due di quei tagli lasciano il prodotto **peggio di
non aver mergiato niente**. La trappola resta armata finché qualcuno non preme merge nel punto
sbagliato, e nessuna review la vede: il diff completo della PR è corretto.

Segnale: nel ramo esiste un commit il cui messaggio dice «fix», «undo», «revert» o «restore» di
qualcosa che un commit precedente **dello stesso ramo** ha fatto.

Mossa: **nessun commit lascia il ramo in uno stato peggiore del precedente.** Se una tua correzione
annulla un tuo difetto introdotto prima nello stesso ramo, i due si fondono con `rebase -i` *prima*
della review, così non esiste taglio che possa separarli. È la regola di Kent Beck che questo repo
già ha — riordino separato dal cambio di comportamento — applicata al ramo invece che al singolo
commit. Il controllo, prima di chiedere la review:
```bash
git log --oneline <base>..HEAD                    # ogni prefisso è uno stato che può finire in produzione
git log --oneline <base>..HEAD -- <file-rischioso>   # quanti commit lo toccano: uno solo = sicuro per costruzione
```
**La domanda giusta è sulla STRUTTURA, non sul contenuto**: *quali commit toccano il file
rischioso*, non *quale stringa ci compare*. Il secondo comando risponde in una riga, senza loop e
senza pipe da cui possa uscire qualcosa di diverso a ogni giro. Se quel file è toccato da un commit solo, la trappola è
impossibile per costruzione — ogni prefisso lo contiene — e non serve leggere una riga. Se è
toccato da due e il secondo ripara il primo, è armata comunque, qualunque cosa dica il grep.

**E la stessa cura vale per come si SCRIVE il risultato.** «Solo il primo di quattro commit tocca
quel file» invecchia al quinto commit e obbliga a riverificare; «un solo commit tocca quel file»
resta vero finché nessuno lo tocca una seconda volta — che è esattamente la condizione di pericolo.
Un'affermazione che nomina un conteggio va rifatta a ogni push, una che nomina la proprietà si
difende da sola.

**E il controllo si sceglie perché non oscilla, non perché è breve.** Verificando proprio questa
cosa, `grep` su un `git cat-file` in un `for` ha dato a due persone tre risposte diverse alla stessa
domanda (`5, 2, 0, 0`, poi zero ovunque, poi righe di diff al posto del contenuto). `--name-only`
non oscilla: risponde con l'elenco dei file, che è un fatto del commit e non del modo in cui lo
interroghi. Un controllo che devi rifare per credergli non è un controllo — e qui la lezione sul
non fidarsi del proprio ramo stava per essere depositata sulla base di un loop mai testato.

Questa lezione è più forte delle altre due che l'hanno accompagnata, perché quelle dipendono da
qualcuno che si ricordi di controllare; questa toglie la possibilità che il taglio sia dannoso.

### Il dev server serve il branch di prima dopo un checkout nello stesso worktree
Segnale: una spec e2e fallisce come se la modifica non ci fosse (voce di menu assente, gesto che
non fa niente) e `curl http://localhost:<porta>/src/<file>` non contiene il codice appena scritto.
Vite non sempre vede i file cambiati in blocco da un cambio di branch. Mossa: dopo ogni cambio di
branch riavvia il dev server e controlla col `curl` del modulo prima di credere a un rosso e2e.

Anche senza checkout il watcher a volte smette di vedere i file salvati: il `curl` del modulo
mostra il codice vecchio. Stessa mossa, riavvio prima di ogni giro e2e.

### Un `ondblclick` di Svelte che non scatta mai
Segnale: il listener in cattura su `document` vede il dblclick sul tuo elemento, il gestore Svelte
no. Svelte 5 delega `dblclick`/`click` alla radice; un antenato (la tela, un nodo) ferma la
propagazione prima. Mossa: `addEventListener('dblclick', …)` diretto sull'elemento in un
`$effect`, e un test e2e che fa il gesto vero.

### Con un `.env` copiato nel worktree la suite unitaria diventa rossa
Segnale: dopo aver copiato `.env` per un e2e `@real`, `ai-models-sync`, `canvas-catalogue`,
`generate.test`, `settings-actions-upgrade` e altri falliscono con `.eq(...).eq is not a function`
o liste con un modello in più, e in CI sono verdi. Causa: i test leggono la configurazione vera
(chiavi Kie, Stripe) invece dei default vuoti. Mossa: sposta `.env` fuori dal worktree prima di
`vitest`, rimettilo solo per l'e2e.

## Test: distinguere il tuo difetto dal rumore

### Un test "lento a intermittenza" può non essere lento affatto
Segnale: un test con budget di tempo fallisce in CI in 70–90 ms. Leggi l'errore, non il nome:
`cursor-smoothness` falliva per `Page.captureScreenshot: Unable to capture screenshot` (nessun
frame ancora nel compositor), non per jolt. Mossa: `gh run view <id> --log-failed` sulle run
rosse prima di toccare soglie. E un budget in ms assoluti su un runner GitHub oscilla 2× (shader
1080p: 27–62 ms, stesso codice): si misura in rapporto a un riferimento nella stessa pagina,
interlacciato, mediana.

### CI rossa con zero test falliti è una promessa non attesa, non un test tuo
`Test Files 649 passed | Tests 7259 passed | Errors 1 error`, e il job esce comunque 1. Non
cercare il test rosso: non esiste. Vitest conta come fallimento anche una `Unhandled Rejection`
sollevata FUORI da un test — qui `supabase.rpc is not a function` da `credits.ts`, arrivata da un
`loadDeferred` di `+layout.server.ts` che risolve dopo la fine del file che l'aveva avviata
(`home-redirect.test.ts`), su uno stub senza `.rpc`. Il file, eseguito da solo, passa: la promessa
fa in tempo a essere raccolta. Segnale: la riga `This error originated in "<file>"` seguita da
`It doesn't mean the error was thrown inside the file itself`.

**La mossa: cerca lo stesso messaggio su una run che NON contiene il tuo diff.** E qui sta la
trappola, pagata per intero: `gh run list --branch dev` restituisce anche la run del merge del tuo
stesso PR, che il tuo diff ce l'ha dentro. Preso quello per prova d'innocenza, hai scritto
«riprodotto senza le mie modifiche» avendo misurato esattamente le tue. La prova buona si prende
da un PR altrui e si verifica, non si assume:

```
gh run list --commit "$(gh pr view <altro-pr> --json headRefOid -q .headRefOid)" \
  --workflow ci.yml --limit 1 --json databaseId -q '.[0].databaseId'
gh run view <id> --log-failed | grep -c '<messaggio>'
git merge-base --is-ancestor <tuo-primo-commit> <quella-sha>   # deve dire NO
```

L'ultima riga è quella che chiude la questione: se il tuo commit non è antenato di quella sha, il
difetto è latente e non è tuo. E non fidarti del solo «dev è verde»: la run di dev può essere
caduta prima, sugli e2e, senza mai arrivare alla suite unitaria.

### La suite completa fallisce da sola: confronta run-per-run con dev puro
Sotto carico (worker paralleli) i test di timing e race cadono da soli: `redact` ≤ 200ms che ne impiega 404, JPEG ≤ 2MB, drain "executes exactly once". Lo stesso sottoinsieme, rilanciato isolato, passa. Prima di imputarsi un fallimento della suite completa: (1) rilancia il sottoinsieme isolato, (2) lancia la suite completa su **dev puro** nello stesso setup. Se dev fallisce uguale, il rumore non è tuo. Vero anche il rovescio: "tutta verde" sul tuo branch non dice niente se dev non lo è.

### Il numero di file rossi che cambia tra run è un timeout, non una race
"9 file rossi, poi 11, sullo stesso albero": quando l'insieme dei falliti varia tra run e la stragrande maggioranza dei test dice `Test timed out in 5000ms`, non cercare una race — è il timeout per-test al default di Vitest (5s) che i test I/O-bound attraversano in modo non deterministico secondo il carico della macchina (misurato: 38 timeout su 43 test falliti in una run, con picchi fino a 15 file su 509). Mossa: `testTimeout` esplicito in `vite.config.ts` (120s: i turni kit completi toccano i 40s da soli e oltre il minuto con la macchina satura da altre sessioni, e un hang vero brucia in minuti, non in secondi) e soglie perf ben sopra il rumore (`redact` da 200ms a 1s: il regex catastrofico che il guardrail caccia brucia in secondi, i 342ms di rumore no).

### Il sonno fisso prima dell'asserzione è la race in nuce
`await new Promise(r => setTimeout(r, 250))` e poi asserire su righe salvate in background: sotto il carico della suite intera i 250ms non bastano e l'asserzione vede lo stato a metà (`expected false to be true` su un `every(done)`). Segnale: test che passa da solo e cade solo nella suite completa, su un'asserzione che riguarda lavoro asincrono post-fine-turno. Mossa: `vi.waitFor(() => expect(statoFinale)...)` — aspettare la CONDIZIONE, non un numero di millisecondi sperato; già usato in `tool-job-drain.test`.

### Il `git rebase` scarta da solo il commit già squashato in dev
PR squash-mergiata + branch di lavoro con più commit: `git rebase origin/dev` riconosce il contenuto identico, salta il commit e resta solo quello nuovo. Zero conflitti. Poi `push --force-with-lease` e PR nuova con un commit solo.

### Guarda lo stato della PR prima di diagnosticare lag
`gh pr view` che mostra il vecchio head per minuti sembra cache di GitHub. Può essere che la PR sia **chiusa** e il branch cancellato — e che il tuo push l'abbia ricreato come orfano. `gh api repos/:org/:repo/pulls/N --jq '.state'` prima di ipotesi sulla freschezza dell'API.

### Il test che va in TIMEOUT (non che fallisce) è un modulo nuovo non mockato
Dopo un merge da dev, un test della PR entra in timeout di 30s invece di fallire: dev ha aggiunto un ramo (`AGENT_KIT=on` → `runKitTurn` dal drain) che il vecchio test non mocka, e la suite resta appesa a una sessione viva. Segnale: timeout senza AssertionError, e `.env` locale che accende la feature. Mossa: spegni il ramo non mockato nel `beforeEach` del suite (`env.AGENT_KIT = 'off'`) — il test copre il motore classico, non il bridge.

### Le factory `vi.mock` invecchiano col merge, non col typecheck
Il mock scritto nell'era della PR non dichiara gli export nuovi di dev (`createSubagentTools`, `MAX_CRITERION_CHARS`, `loadMemoryEntries`): l'errore `No "X" export is defined on the "Y" mock` esplode a runtime a metà test, mai in compilazione. Stesso segno per il fake supabase che manca di un metodo nuovo (`query.or is not a function`). Mossa: a ogni errore di quel tipo aggiungi l'export — o meglio `...actual` via `importOriginal` e override selettivi.

### Lo script fuori dalla suite marcisce in silenzio, e il `null as never` è la data di scadenza
`scripts/eval/creative.ts` moriva al primo passo con `TypeError: Cannot read properties of undefined`: `proposeRubrics`, `planStrategy` ed `executePlan` avevano perso il parametro `ai` in `80666f7e` («Drop the dead ai parameter from every signature»), e la sonda passava ancora `(null as never, BRAND, …)`. Nessun test la copre — è uno script, non un test — e nessuno la lanciava perché costa soldi veri, quindi il difetto è rimasto lì per settimane senza che niente diventasse rosso. Segnale: un `null as never` (o un `as any`) in testa a una chiamata, che è esattamente il cast che impedisce al compilatore di dire «quella firma è cambiata». Mossa: quando togli un parametro da una firma, cerca i chiamanti **fuori** da `src/` (`scripts/`, `cli/`) — e togli il cast, perché un argomento che ha bisogno di `as never` per passare il typecheck è un argomento che non dovrebbe essere lì.

### Su un'API che ignora i campi sconosciuti, una prova che «passa» non prova niente
Mandato a OpenRouter un `reference_images` con un URL invalido: accettato, quindi sembrava supportato-ma-rotto. Poi mandato un campo chiamato `pippo_inesistente`: accettato uguale. L'API **scarta in silenzio ciò che non conosce**, quindi il primo test misurava solo il mio errore di nome. Mossa: prima di concludere qualcosa da una richiesta accettata, manda un campo inventato di sana pianta — se passa anche quello, l'accettazione non dice nulla sul campo che ti interessa.

### 402 dalla sonda di drift e «Unauthorized» da `db:types`: è la quota di egress, non il codice
Con il progetto Supabase oltre la quota di egress, PostgREST risponde 402 a tutto (lo
schema-drift-check fallisce il proprio autotest) e la generazione dei tipi via MCP dice
`exceed_egress_quota`; `apply_migration` ed `execute_sql` via MCP invece funzionano. Segnale: 402
ovunque, anche su tabelle esistenti. Mossa: applica la migration via MCP, scrivi a mano le voci in
`database.types.ts` nel formato generato, dillo nel changelog e rigenera appena la quota torna.

### Egress alto con un database minuscolo: guarda gli URL firmati, non le query
Quota di egress superata con 5 utenti e un database da 100 KB. Gli edge logs per conteggio
mettono in cima `node_runs` e `assets` (migliaia di GET), ma sommando
`response.headers.content_length` per path il REST pesa < 1 MB: i byte stanno in
`/storage/v1/object/sign/...` e `render/image/sign`, con `cf_cache_status` HIT ≈ 0 e lo stesso
file scaricato decine di volte al giorno. Segnale: stesso path, token diverso a ogni richiesta.
Mossa: ordina per byte, non per richieste; un file privato deve avere UN URL finché la firma è
fresca (`signThumbnailUrls` lo ricorda), e un redirect a una firma non è `no-store`.

### Il test della PR può aspettare il vecchio contratto
`toHaveBeenCalledWith` con 6 argomenti contro un executor passato a 7 (dev ha aggiunto la riga `job`): fallisce nel merge senza che nessuno abbia toccato il file. Mossa: nel riesame di un merge, fai girare PRIMA i test dei file in conflitto — sono gli unici che fanno da spec su entrambi i lati.

## Una funzione che pretende un ordine va chiamata col nome dell'ordine che pretende

**Segnale.** La conversazione intera capovolta — la risposta sopra la domanda — e i messaggi più
vecchi al posto dei più recenti quando il thread supera il limite. Non «ogni tanto disordinata»:
sempre, e solo sulla lettura che passa dal log degli eventi.

**Causa.** `chronologicalTail(newestFirst, limit)` fa `slice(0, limit).reverse()`: è corretta solo
se l'input arriva `order('created_at', desc)`. Un secondo chiamante le ha passato la proiezione del
log, che esce in ordine di `seq` — cioè al contrario. Il tipo era `T[]` in entrambi i casi, quindi
il compilatore non aveva niente da dire, e il ramo di fallback restava giusto: la suite verde per
tutti e due.

**Mossa.** Il presupposto sta nel NOME, non in un commento: `chronologicalTail` per una lista
`desc`, `newestTail` per una già cronologica. E un ramo di lettura aggiunto senza test è il posto
dove questo ricapita: il test che ordina quattro messaggi costa tre righe.

## Un test che mocka il cancello di cui parla non dimostra niente

**Segnale.** Un test di route asserisce un comportamento di autorizzazione — «una chiave di sola
lettura passa», «un utente scaduto viene fermato» — e passa al primo colpo, senza essere mai stato
rosso per la ragione giusta. In cima al file c'è `vi.mock('$lib/server/cli-auth', …)`.

**Cosa succede.** Il verdetto che il test crede di misurare lo produce il mock, non il sistema.
È capitato con `check_content`: la route non chiama `checkApiKeyWriteAccess` perché sarebbe
ridondante, e il test concludeva che quindi una chiave di sola lettura arriva a calcolare. Falso:
`resolveCaller` nega **ogni** non-GET a una chiave `read` prima che la route parta. Il test
asseriva uno stato che la produzione non può produrre, quindi non poteva fallire mai — e intanto
diceva al prossimo lettore l'opposto della verità, che è peggio di non dire niente.

**La mossa.** Prima di asserire su un permesso, leggi dove il permesso viene deciso davvero, e
chiediti se il mock lo sta scavalcando. Se lo scavalca, resta una sola asserzione onesta: dato il
verdetto che l'upstream produce sul serio, la route lo rispetta e non lavora. Il resto — che
l'upstream produca quel verdetto — è un test dell'upstream, e va scritto lì o non va scritto.

## Un valore che il CHECK rifiuta è invisibile a una suite che mocka il database

**Segnale.** Una funzione che deposita qualcosa in una tabella «riesce» in ogni test e in
produzione la riga non c'è. Il codice scrive una stringa in una colonna con un `CHECK ... in (…)`,
e quella stringa non è nella lista. Nei log non c'è niente, perché il fallimento è gestito
best-effort: `{ error }` restituito al chiamante e mai stampato.

**Cosa succede.** Il vincolo vive nel database, il valore vive nel codice, e la suite mocka
Supabase: un insert finto accetta qualunque stringa, quindi il test è verde per costruzione. È
capitato a `brand_media.source`: `saveRenderedVideoToLibrary` scriveva `'ai'` e il `save_to_library`
della sandbox scriveva `'sandbox'`, nessuno dei due nel vincolo. Ogni video renderizzato veniva
pagato, caricato su storage e poi rifiutato dalla libreria con 23514 — l'esatto vicolo cieco che
quella funzione era stata scritta per chiudere. Il best-effort è la scelta giusta (non si fa fallire
un render pagato per un INSERT) ma trasforma il difetto in lavoro pagato e buttato in silenzio.

**La mossa.** L'insieme ammesso diventa **una costante esportata accanto al modello che governa la
colonna**, il campo è tipato su quella costante, e tre asserzioni la tengono onesta: la costante
confrontata con l'array dell'ultima migration che definisce il vincolo; una scansione del sorgente
che pretende ogni literal scritto in quella colonna dentro la costante; un `@ts-expect-error` sul
valore vecchio, che fa fallire `npm run check` il giorno in cui il tipo smette di mordere. Il test
che vale non è «il mock ha accettato l'insert» — quello non può fallire — ma «il valore è
nell'insieme che il database ammette», e va munito di un guardiano contro il passaggio a vuoto
(`written.length > N`): una scansione che non trova più niente deve fallire, non passare. E il
fallimento best-effort si fa sentire — `swallow()` dove `$lib` è già in casa, `console.error('[X] …')`
dove non lo è: resta non fatale, smette di essere muto.

**Il corollario che è costato due minuti in più.** `supabase-js` **risolve** con `{ error }` su un
23514, non rigetta. Un `.then(() => {}, () => {})` o un `.catch(() => {})` su una insert non vede il
vincolo nemmeno volendo: è gestione d'errore che non può funzionare. L'errore va letto dal valore
risolto.

## Un presidio creato a mano in produzione costa due volte, e la seconda non fa rumore

**Segnale.** Una migrazione che gira da settimane in produzione uccide `db:migrate` su un database
pulito, con un errore che nomina un oggetto che nessuno ha mai scritto in un file: qui
`42883 — function public.rls_auto_enable() does not exist`, da una `revoke` su una funzione che
esisteva solo in produzione perché era stata creata dalla dashboard.

**Cosa succede.** Il primo costo si vede: la catena si ferma, e siccome ogni file gira nella sua
transazione non si perde una riga, si perde tutto quello che viene dopo. Il secondo costo non si
vede ed è più caro: **un ambiente nuovo nasce senza il presidio**. `ensure_rls` accende la row level
security su ogni tabella nuova di `public`; senza, ogni tabella creata da lì in poi resta scoperta
finché qualcuno non legge `pg_class`. Un controllo di sicurezza che esiste in un ambiente solo non
è un controllo: è una coincidenza che regge finché non si ricrea il database.

**Perché la suite non lo vede.** Gira su Supabase mockato, dove nessuna migrazione viene applicata
davvero. A trovarlo è stato un agente che ricostruiva un database da zero per un altro lavoro — cioè
l'unica cosa che esercita l'ordine reale di applicazione. Vale la regola generale già pagata qui: chi
scrive la modifica la rilegge da autore, e la riga accanto la vede solo chi non ha una posta in gioco
su quella modifica.

**La mossa.** Quando `psql` o la dashboard creano qualcosa che deve esistere sempre — una funzione, un
event trigger, una policy, un bucket — quella cosa entra in una migrazione **nello stesso giorno**, in
forma idempotente: `create or replace` per una funzione, e per ciò che non ha un `if not exists`
(gli event trigger non ce l'hanno) una guardia sul catalogo. E la prova che serve non è che il file
gira in produzione, dove l'oggetto c'è già: è che gira su un database **vuoto**. Un database usa e
getta e due `psql` sono dieci minuti, e sono l'unico posto dove il difetto è visibile.

## Il vocabolario di una colonna si deriva dal CODICE, non dalle righe che ci sono

**Segnale.** Una correzione ovvia: un valore fuori dall'enum, sostituito con quello «giusto»
guardando la costante. Nessun test rosso, il vincolo passa, la PR sembra più pulita di prima.

**Cosa succede.** `posts.content_type` sembrava nomenclatura, e `post-from-asset.ts` ci scriveva
`image` e `carousel` — che sono FORMATI, non tipi. Sostituirli con `uploaded_image` era corretto
guardando `POST_CONTENT_TYPES` e sbagliato guardando `publish.ts:380`, che fa
`aiGeneratedMedia: !content_type.startsWith('uploaded')`: quel prefisso **è** la dichiarazione di
contenuto AI al momento della pubblicazione. Prima di quella modifica tutte e tre le forme
dichiaravano; dopo, immagini e caroselli presi dalla libreria smettevano di dichiarare. Un enum
allineato e una conformità spenta, nello stesso commit, senza un solo test rosso — perché nessun
test lega il prefisso di una stringa a ciò che viene dichiarato a un social.

**La mossa.** Prima di cambiare un valore in una colonna, `grep` di chi la **legge**, non solo di
chi la scrive — e in particolare di chi ne legge un *pezzo* (`startsWith`, `includes`, uno `split`),
perché quello non compare cercando il valore intero. Se un lettore ne ricava una decisione di
conformità, di pagamento o di pubblicazione, il valore non è nomenclatura: è un contratto, e la
riga accanto va letta prima di toccarlo. Il default in caso di dubbio lo dice già il commento
accanto a quella riga: sovra-dichiarare non è un rischio, sotto-dichiarare sì.

**E l'altra metà della stessa regola: nemmeno chi la SCRIVE.** Lo stesso giorno, nella stessa PR,
il vincolo `posts.source in ('plan','manual','radar','guest_preview')` è stato costruito contando
le righe di produzione — zero violazioni, elenco confermato. Ma due percorsi vivi scrivono
`cross_post` (il clone cross-post) e `founder` (la consegna video dall'admin): sono rari e non
avevano ancora prodotto righe. Il vincolo sarebbe morto con un 23514 alla prima esecuzione di uno
dei due, cioè avrebbe rotto quello che il codice scrive oggi.

**Un vocabolario convalidato contro i dati esistenti non è convalidato contro il codice.** Le righe
dicono soltanto se la migration passa adesso; non dicono se il vincolo è giusto. L'elenco si deriva
dai punti di SCRITTURA — e qui lo strumento c'è già: la sezione C di `scripts/schema-drift-check.mjs`
confronta ogni literal del codice con le liste `CHECK` dei file di migration e stampa file e riga.

**E conta QUANDO la lanci: prima di decidere, non prima di aprire la PR.** Non è una sfumatura.
Lanciata prima di scegliere il vocabolario, ti dice qual è la lista ammessa: è un input. Lanciata
quando la lista l'hai già scelta, ti dice solo se per caso avevi ragione — e a quel punto la leggi
da autore, cioè cercando conferma. Qui è stata lanciata dopo il merge, ed è esattamente per questo
che il difetto è passato: lo strumento aveva la risposta dal primo minuto, io sono arrivato con una
tesi da difendere. Il momento in cui guardi decide se stai leggendo o se ti stai dando ragione.

**Il corollario sul metodo.** A trovarlo non è stato un vincolo né la suite: è stato un altro
agente che leggeva la riga accanto per un lavoro diverso. E non e' «due persone attente»: ognuno
ha preso il difetto dell'ALTRO, mai il proprio. Chi scrive la modifica la rilegge da autore, e la
riga accanto la vede solo chi non ha una posta in gioco su quella modifica.

## Un `onConflict` sbagliato ha due facce: una non scrive, l'altra cancella

**Segnale.** Due segnali opposti, stessa causa. O una funzione riporta di aver salvato N righe e la
tabella non le ha — nessun log, nessuna eccezione, risultato positivo al chiamante. Oppure la
scrittura riesce e una riga che c'era prima non c'è più.

**Cosa succede.** `onConflict: 'brand_id,name'` esige un indice UNIQUE su quella coppia. Se non
c'è, Postgres risponde **42P10** (*no unique or exclusion constraint matching the ON CONFLICT
specification*) e `supabase-js` **risolve** con `{ error }` — non rigetta. Una chiamata che non
destruttura `error` non se ne accorge: su `competitors` esisteva solo `competitors_brand_idx`, che
è un indice normale, e il job «ri-cerca i concorrenti» riportava i concorrenti trovati scrivendo
zero righe. Non è un caso raro: `create index` e `create unique index` si leggono uguali di
sfuggita, e l'`onConflict` viene scritto guardando le colonne, non gli indici.

**L'altra faccia, che è la peggiore.** Se l'indice unico c'è ma è su una coppia DIVERSA da quella
che hai in testa, non c'è nessun errore: l'upsert riesce e **sovrascrive**. `brand_social_handles`
è unica su `(brand_id, platform)` — un handle per rete, non uno per nome — quindi scrivere un
secondo handle Instagram per lo stesso brand non ne aggiunge uno: cancella quello che c'era. È
stata una quasi-vittima in questa stessa PR, in due punti: la migration che spostava gli handle dal
campo sito (guardia scritta su `username`, cioè sulla colonna sbagliata: sarebbe morta con un 23505
abortendo TUTTA la migration) e il codice che li raccoglie in onboarding, che avrebbe silenziosamente
rimpiazzato un handle dichiarato dall'utente con uno dedotto da un campo compilato male. Il primo
caso fa rumore, il secondo no.

**La mossa per questa faccia.** Prima di un `onConflict`, leggi la coppia unica REALE e chiediti
cosa significa come regola di prodotto: `(brand_id, platform)` non è un dettaglio di indice, dice
«un brand ha un solo account per rete». Se la tua scrittura può produrre due righe che collidono su
quella coppia, stai scegliendo quale delle due sopravvive — quindi scegli esplicitamente
(`do nothing` per tenere l'esistente, `do update` per sostituirlo) invece di scoprirlo dopo.

**La mossa, per entrambe.** Ogni `onConflict` va verificato contro `pg_indexes` della tabella, non
contro l'intenzione: `select indexdef from pg_indexes where tablename = '<t>'` e cercare `UNIQUE`. È una
riga di SQL contro un difetto che non lascia tracce. E l'errore va **letto**: `const { error } =
await supabase.from(...).upsert(...)`, sempre — vale per il 42P10 come per il 23514.

## Un `catch` muto su un percorso di ricavi nasconde il difetto finché non lo cerchi a mano

**Segnale.** Nessun errore, nessun allarme, tutto verde — e un limite che non limita niente. Qui:
il gating crediti è stato spento in produzione per circa una settimana, l'AI girava senza quota
per chiunque, e non esisteva **una sola riga di log** che lo dicesse. È emerso solo perché
qualcuno è andato a leggere `billingProvider()` per un altro motivo.

**Cosa succede.** Un fallback permissivo scritto per un caso legittimo (il fork self-hosted senza
billing) copre anche il caso illegittimo (il provider a pagamento che non si carica in
produzione), e i due sono indistinguibili da fuori: entrambi restituiscono lo stesso provider che
concede tutto. Il `catch` senza log li appiattisce.

**La mossa.** Su un percorso che decide se si può spendere o incassare, il fallback si riporta —
`swallow()` (console + Sentry), una volta per processo se il chiamante è un hot path. E si
distingue sempre **la scelta** dall'**incidente**: `BILLING_PROVIDER=open` impostato di proposito
resta silenzioso, il fallback non voluto no. Un allarme che suona anche quando va tutto bene viene
ignorato, e allora tanto valeva il silenzio.

**Il test che lo tiene.** `src/lib/server/billing/fallback-report.test.ts`: il fallback riporta,
la scelta esplicita no, e riporta una volta sola.

## Una guardia che legge il nome dell'host, e segue i redirect, non è una guardia

**Segnale.** Una funzione scarica un URL e la difesa è una lista di pattern di hostname
(`isUrlSafe`, `!u.includes('localhost')`, una regex su `.local`), oppure il tetto di byte sta
DOPO un `await res.arrayBuffer()`, oppure `fetch` è chiamata senza `redirect: 'manual'`. Tre
sintomi diversi dello stesso difetto: ciò che viene controllato non è ciò che viene raggiunto.

**Perché non regge.** Il nome è scelto da chi attacca e il DNS pure: `cdn-innocuo.example` può
risolvere su `127.0.0.1` o su `169.254.169.254` e la stringa resta impeccabile. Il redirect è
peggio, perché la destinazione non l'hai nemmeno vista: un URL pubblico risponde `302 Location:`
e la guardia aveva già approvato l'unico URL che ha guardato. E un tetto applicato dopo aver
bufferizzato è un tetto che si applica a memoria già consumata — 100MB entrati per rifiutarne 5.

**Mossa.** Tre proprietà, e servono tutte e tre insieme:

- **risolvi, poi controlla** l'indirizzo che torna dal resolver, non l'hostname;
- **ricontrolla ogni hop** (`redirect: 'manual'` + ciclo tuo), schema compreso: un `302` da https
  a http consegna il file a chiunque stia sul percorso;
- **applica il tetto mentre il corpo arriva**, e per un file **rifiuta** invece di troncare — un
  JPEG tagliato è un asset corrotto salvato come se fosse intero.

In questo repo tutto ciò esiste già in `safeFetchBytes` (`tool-guard.ts`): **riusala, non
riscriverla.** Due copie di una guardia SSRF sono due guardie che divergono, e la seconda diverge
in silenzio. Se un chiamante ha bisogno di regole diverse (solo https, un tetto più alto, un altro
User-Agent) quelle sono *parametri* della guardia — mai un `if` prima della chiamata, che il ciclo
dei redirect non vedrebbe.

**Dove guardare per prima.** Le funzioni il cui URL lo sceglie un MODELLO: lì l'input è già
collegato a contenuto ostile, e il difetto smette di essere teorico.

**E il test che lo prova non è quello dell'esito.** Bufferizzare-e-poi-misurare restituisce lo
stesso rifiuto di fermarsi a metà: il test passa e non prova niente. Conta i pezzi che il lettore
TIRA — prima ne chiedeva 400 su un tetto di venti.

## Un fake che risponde alla domanda sbagliata nasconde il difetto che cercavi

**Segnale.** Uno stub di `fetch` fatto a mano: `headers: { get: () => 'image/png' }`, più un
`arrayBuffer()` e nessun corpo. Risponde `'image/png'` a `location` e a `content-length`, cioè
racconta una risposta che nessun server manderebbe mai — e il giorno che il codice sotto comincia
a leggere quegli header, o a leggere il corpo a stream, il test si rompe per il motivo sbagliato.

**Mossa.** Negli stub di rete usa una `Response` vera: `new Response(bytes, { status, headers })`.
Costa una riga in meno e non può mentire su un header che non hai previsto.

**Corollario sulle fixture.** Un URL di prova come `https://cdn.example` smette di funzionare nel
momento in cui la guardia RISOLVE l'host invece di leggerlo: il rifiuto arriva da `ENOTFOUND` e
non dalla proprietà sotto esame. Usa un indirizzo scritto per esteso (`https://93.184.216.34`):
`dns.lookup` lo restituisce senza interrogare nessuno, e resta pubblico.

## Un timeout nella suite completa non è un difetto finché non lo riproduci da solo

**Segnale.** `npm run test:unit` riporta `Hook timed out in 60000ms` o `Test timed out in
30000ms` su file che non hai toccato, e la stessa suite era verde un'ora prima.

**Cosa succede.** Il costo è il *transform* di Vite, non il test: con la cache fredda — o con
altri lavori pesanti sulla stessa macchina — il grafo di `$lib/agent/tools/index` supera da solo
il budget del `beforeAll`. Nella stessa sessione lo stesso file è passato in 53s e fallito a 60s
solo perché in parallelo girava un'altra suite.

**La mossa.** Prima di diagnosticare, isola: esegui il file DA SOLO, a macchina scarica. Se serve
la prova che il difetto non è tuo, salva le modifiche in una patch
(`git diff > /tmp/x.patch`, mai `git stash`), ripristina i sorgenti, riesegui: se fallisce anche
senza le tue modifiche, è ambiente. Il timeout del `beforeAll` scritto nel file vince sul flag
`--hookTimeout` della CLI, quindi per una diagnosi va alzato nel file e rimesso subito dopo.

## Un IPv6 può portarsi dentro un IPv4, e il divieto va all'indirizzo dentro

**Segnale.** Un classificatore di indirizzi privati che tratta l'IPv6 per come *comincia* —
`::1`, `^f[cd]`, `^fe[89ab]` — e l'IPv4 con le sue regole, senza che i due si parlino. Provalo
con `::ffff:127.0.0.1`: se risponde "pubblico", il buco c'è.

**Cosa succede.** `::ffff:127.0.0.1` (mapped), `2002:7f00:1::` (6to4) e `64:ff9b::7f00:1` (NAT64)
sono tutti modi di scrivere `127.0.0.1` dentro un IPv6, e l'indirizzo che viene chiamato davvero è
quello dentro. `dns.lookup(host, { all: true })` restituisce i record **AAAA verbatim**, quindi la
forma arriva alla guardia esattamente così: basta un AAAA su un nome pubblico. La forma con le
parentesi è rifiutata solo perché `URL.hostname` le tiene e la risoluzione fallisce — un rifiuto
per **effetto collaterale**, che sparisce il giorno che qualcuno normalizza l'hostname.

**Mossa.** Estrai l'IPv4 incapsulato e rimandalo alle regole IPv4, invece di allungare la lista
dei prefissi vietati: una lista si allunga a ogni forma nuova, e la forma nuova la scopri dopo che
ti è passata davanti. Espandi il `::` e leggi gli hextet per posizione — `::ffff:7f00:1` e
`0:0:0:0:0:ffff:7f00:1` sono lo stesso indirizzo e una regex sul prefisso ne vede uno solo.
Un IPv4 pubblico incapsulato deve restare pubblico: la regola è quella dell'IPv4, non un divieto
sul prefisso.

**E il test giusto non è quello del classificatore.** Quello prova la funzione; la proprietà che
conta è che `assertPublicUrl` rifiuti un host il cui **AAAA** è una di quelle forme — con
`lookup` sostituito perché restituisca `family: 6`. È il test che resta vero anche se domani il
rifiuto smettesse di arrivare dal ramo che lo produce oggi.

**Corollario generale.** Quando un rifiuto arriva "per fortuna" da un ramo diverso da quello che
dovrebbe produrlo (qui: «could not resolve» invece di «non è pubblico»), non è protezione: è una
coincidenza con la data di scadenza. Fissala in un test che nomina la proprietà, non il
meccanismo.
## Il file che leggi non è sempre il file che è in produzione

`https://mcp.dazero.co/.well-known/oauth-protected-resource` annunciava
`authorization_servers: ["https://dazero.co"]` mentre `authServerUrl()` in `cli/lib/config.ts`
— letto in questo repo, su `dev` e su `main` — restituisce `https://www.dazero.co`. Nessuna
delle due letture era sbagliata: il progetto Vercel che serve quel dominio (`dazero-cli`) è
agganciato al repo **pre-monorepo** `andreabuttarelli/dazero-cli`, il cui `authServerUrl()`
ritorna ancora l'apex, e la cui ultima deploy di produzione è di tre settimane prima
dell'import nel monorepo. Il codice giusto non è mai arrivato in produzione perché nessuno
deploya quel dominio da qui.

Segnale: la produzione contraddice il codice che hai appena letto, e il `git log` del file
mostra un solo commit — quello di import — senza traccia della modifica che stai cercando.
Mossa: prima di diagnosticare, chiedi a Vercel **da quale repo e da quale commit** è servito
quel dominio (`list_projects` → `link.repo`, `list_deployments` → `meta.githubCommitRepo`).
Una funzione letta in locale non è una prova su cosa gira: il repo di origine è parte della
domanda.

**La regola dietro**: quando un dominio del prodotto non è servito dal repo in cui stai
lavorando, il repo non può ripararlo — può solo smettere di regredire. Il test di contratto
serve comunque, perché il giorno in cui il dominio torna a essere servito da qui il difetto
non rientra; ma la riparazione è ripuntare il progetto, e va detta come tale invece di essere
spacciata per un fix di codice.
## Una colonna che la migration non ha mai creato si traveste da «brand non trovato»

**Segnale.** Una lettura che «non può fallire» torna `null` per tutti — non per un tenant, non a
intermittenza: per tutti — e la superficie sopra risponde con un errore di chi chiama (404, «Brand
not found»). La suite è verde, perché il client Supabase è mockato e un mock non ha uno schema.

**Cosa succede.** `orgBillingForBrand` seleziona `plan, stripe_customer_id, stripe_subscription_id`
da `organizations`. In produzione quelle colonne non ci sono: la migration `20260903190000_org_billing_schema.sql`
non è mai stata applicata, perché i deploy di questo repo non applicano migration. PostgREST
risponde 400, `supabase-js` **risolve** con `{ data: null, error }`, la funzione ignora `error` e
restituisce `null`, e il chiamante legge quel `null` come «questo brand non ha un'org». Il bottone
del portale su `/app/billing` risponde 404 a chiunque, e sembra un problema di permessi.

**La mossa.** Prima di diagnosticare il codice, `node scripts/schema-drift-check.mjs`: è in sola
lettura, punta alla produzione senza paura, ed esce 1 con l'elenco delle colonne che il codice
nomina e il database non ha. Va eseguito **dopo ogni migration scritta e prima di ogni PR che
tocca il database** — non solo quando qualcosa è già rotto. Un `select` di colonne che potrebbero
non esistere non è mai «non può fallire»: o si legge `error`, o il difetto arriva travestito da
colpa di chi chiama.

## Una patch «scaduta» può esserlo solo sulla tua macchina

**Segnale.** `patch-package` dice `Patch was made for version: X / Installed version: Y`, con Y più
nuova. Sembra ovvio: la dipendenza è andata avanti, la patch è da buttare.

**Cosa succede.** In questo repo ci sono due lockfile: `package-lock.json`, tracciato, che la CI usa
con `npm ci`, e `bun.lock`, non tracciato, che vive sulla macchina di chi ha lanciato `bun install`.
Divergono. Il primo pinnava `@ai-sdk/harness@1.0.87` — esattamente la versione della patch — mentre
bun aveva risolto la 1.0.101. La patch era **viva per tutti tranne che lì**, e cancellarla ha fatto
diventare rossa la CI e ha tolto due comportamenti veri: le scritture in blocco di `writeSkills`
(6,9 secondi di attesa) e la conservazione delle parti immagine nell'adattatore pi, che senza patch
**degrada in silenzio** invece di fallire.

**Mossa.** Prima di dichiarare scaduta una patch, leggi la versione nel lockfile **tracciato**, non
quella in `node_modules`. Se coincide con quella della patch, la patch è viva e il problema è
l'install che hai davanti.

**Corollario, e qui è il punto.** Tre errori nello stesso blocco sembravano tre conferme
indipendenti: due dicevano «la patch non applica», il terzo «il pacchetto non c'è». Erano tre
sintomi di **una causa sola** — l'albero di `node_modules` rotto — e nessuno dei tre parlava delle
patch. Dopo un `npm install` pulito applicano tutte e tre. Più errori insieme invitano a
concludere; guarda invece se hanno un antenato comune.

## Un ciclo di import tenuto in piedi dall'ordine cade quando togli un import morto

Cancellato `genWithRetry` — zero chiamanti — e con lui l'`import` che stava alla **riga 2** di
`content-preview/images.ts`. Il server ha smesso di partire: `500` su ogni rotta, e nei log
`[vite] The dependency module is not yet fully initialized due to circular dependency`.

Il ciclo non l'avevo creato io. Era già lì, e si chiudeva così:

```
referrals → credits → scheduler → director → content-preview → caption-quality
    ↑                                                                │
    └───────────────── blog-site ◄─── images ◄───────────────────────┘
```

`images.ts` importava `blog-site.ts` per **una funzione pura di cinque righe** (`firstLogoUrl`,
che legge il primo logo da un array), e `blog-site.ts` è il blog pubblico intero: Marked, client
admin, referral. Finché la riga 2 tirava dentro `plan-pipeline` per primo, i moduli si
inizializzavano in un ordine in cui il cerchio si chiudeva dopo che i pezzi che servivano erano
già pronti. Togliere quell'import ha cambiato l'ordine, e basta.

**Segnale**: una cancellazione di codice morto — un import inutilizzato, una funzione senza
chiamanti — fa comparire `circular dependency` su moduli che non hai toccato. Il file nell'errore
(qui `referrals.ts`) non è il colpevole: è solo dove il cerchio si è chiuso per primo.

**Mossa**: non rimettere l'import morto, e non spostare la cancellazione. Trova il ciclo leggendo
in ordine i `Error when evaluating SSR module` nel log — sono la catena, dall'ultimo al primo — e
**taglialo dove il pezzo condiviso non ha dipendenze**: `firstLogoUrl` è finita in
`$lib/brand-fields.ts`, che è un foglio (zero import) fatto apposta per le funzioni pure sui campi
del brand. Un modulo pesante importato per un helper puro è sempre l'anello da tagliare.

**E la lezione più larga**: un ciclo che regge solo grazie all'ordine di inizializzazione è già
rotto, semplicemente non te l'ha ancora detto. Vale la pena scoprirlo togliendo un import morto in
un pomeriggio, invece che aggiungendo una riga a un file qualunque un venerdì.

**Il controllo che l'ha preso, e quello che non l'avrebbe preso**: `npm run dev` sulla rotta vera.
I 7.289 test unitari erano verdi, `svelte-check` non aveva niente da dire, e il build non era
ancora stato provato. Un ciclo di inizializzazione si vede solo eseguendo — è precisamente il
motivo per cui il cancello del browser non è sostituibile con una suite verde.

## Un mock incompleto non fa fallire un test: fa cadere la suite, e a intermittenza

CI rossa con **7.309 test verdi su 7.309**. Il job falliva su un `Unhandled Rejection`:
`TypeError: supabase.rpc is not a function`, con dentro `home-redirect.test.ts` un file che il
commit non aveva toccato. In locale non si riproduceva.

La catena: `+layout.server.ts` lancia `loadDeferred`, una promessa che **nessuno attende** (SvelteKit
la trasmette in streaming). Il mock supabase del test rispondeva a `from()` con un Proxy che
accetta qualunque metodo — l'autore il rischio l'aveva previsto, e l'aveva scritto nel commento
sopra — ma non rispondeva a `rpc()`. Dentro il differito ci si arriva:
`remaining()` → `getCreditsUsage()` → `fetchStripePeriodStart()` → `supabase.rpc(...)`.

Quindi il rifiuto c'era sempre. Quello che cambiava era **se atterrava prima che il run finisse**,
e quello dipende da quanti file di test esistono e in che ordine vitest li distribuisce. Il commit
ne aveva rimosso uno e aggiunto un altro: abbastanza per spostare la schedulazione e far uscire
allo scoperto un guasto che era lì da prima.

**Segnale**: `Test Files N passed`, `Tests M passed`, e il job rosso lo stesso, con `Errors 1` e un
`Unhandled Rejection` che nomina un file che non hai toccato. Un `grep` su `FAIL|Tests ` nell'output
locale **non lo vede**: la riga da cercare è `Errors` / `Unhandled`.

**Mossa**: completare il mock alla fonte (`rpc: () => chain`, come `from`), non inseguire l'ordine
dei test e non ritentare il job sperando che vada. Un mock che copre solo i metodi che il percorso
felice usa è una bomba a orologeria: il primo cambiamento di schedulazione la innesca, e il file
che esplode non è quello che l'ha piazzata.

**La regola dietro**: dove il codice lancia una promessa che nessuno attende, un mock parziale non
degrada — abbatte tutto il processo. O il mock risponde a qualunque cosa (Proxy), o quel percorso
va atteso e asserito.

## `set role` non è `auth.role()`: una security-definer interrogata da psql risponde zero

Verificando che `sum_org_ai_cost_usd` contasse finalmente una riga senza brand, la funzione ha
risposto **0** mentre la stessa somma scritta a mano sulla tabella rispondeva `0.033646`. Sembrava
esattamente il difetto che stavo chiudendo — la migration non applicata, o il `left join` che non
teneva.

Non era né l'una né l'altro. La funzione porta una guardia:

```sql
and ( auth.role() = 'service_role' or p_org_id in (select public.auth_org_ids()) )
```

`auth.role()` legge il **claim del JWT** (`request.jwt.claims`), non il ruolo Postgres. Da psql
quel claim non c'è, quindi la guardia è falsa per ogni riga, il `where` non ne seleziona nessuna e
`coalesce(sum(...), 0)` restituisce uno zero perfettamente legittimo. `set role service_role` non
cambia niente: è l'altro concetto di ruolo.

**Segnale**: una funzione `security definer` sotto RLS risponde `0` o zero righe da psql, mentre la
query equivalente scritta a mano risponde. Nessun errore, nessun permesso negato — solo un vuoto
che si legge come un difetto della funzione.

**Mossa**: mettere il claim prima di chiamarla, nella stessa sessione.

```sql
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.sum_org_ai_cost_usd(...);
```

**La regola dietro**: una funzione che decide chi può vedere cosa va interrogata con l'identità che
avrà in produzione. Interrogarla senza è come chiamarla da un utente anonimo e concludere che la
tabella è vuota — e la conclusione sbagliata qui è la peggiore possibile, perché «somma zero» è
proprio la forma del difetto che si sta cercando.

## Un test rosso può importare `bun`, non `bun:test` — e vitest non ha un alias per quello

In un worktree pulito la suite chiude con `Test Files 2 failed | 664 passed` e **`Tests 7387
passed`, zero test falliti**: i due file non falliscono, non si caricano proprio. Uno è
`hooks.server.test.ts` (manca `.env`, già qui sopra). L'altro è `cli/mcp/vercel-config.test.ts`:

```
Failed to load url bun (resolved id: bun) in cli/mcp/vercel-config.test.ts
```

`vite.config.ts` aliasa `bun:test` → `vitest`, che è ciò che fa girare i test della CLI sotto
vitest. Ma quel file importa anche `import { $ } from 'bun'` — il **runtime**, non il framework di
test — e per quello non c'è alias possibile: è l'eseguibile bun.

**Segnale**: `Test Files N failed` con `Tests M passed` e **zero** `×`. I file non hanno test
rossi, hanno un import che non risolve. Cerca `Failed to load url`, non `FAIL`.

**Mossa**: prima di attribuirsi il rosso, `git log -1 <file>` — se non l'hai toccato tu,
riproducilo sul checkout principale. E poi **aggiustalo**, perché blocca la CI di tutti: in questo
caso `$` serviva a una riga sola (`git ls-files`), e `execFileSync` da `node:child_process` la fa
girare sotto entrambi i runner.

**La regola dietro**: un file di test che vive sotto due runner può usare solo ciò che entrambi
hanno. `bun:test` ha un alias; il **runtime** `bun` no, e non può averlo — è un eseguibile.
## Un client service role più un identificatore che arriva da fuori

**Segnale.** Da qualche parte c'è `createAdminClient()` — o, sul percorso a chiave API, il
`supabase` che `authenticate()` restituisce, che è la stessa cosa con un altro nome — e nella
stessa funzione c'è un id preso da `params`, dal corpo della richiesta, o da un `formData`. Il
codice attorno ha l'aria protetta: un `.eq('brand_id', …)` da qualche parte, un `canEnter`, un
404 sul brand. Sembra a posto, e in quattro casi su quattro non lo era.

**Cosa succede.** `service_role` ha `bypassrls=true`: le policy non vengono nemmeno valutate.
Quindi la protezione è solo quella scritta a mano, e si rompe in tre modi che sembrano diversi e
sono lo stesso:

1. **Il `WHERE` è scopato, il bersaglio no.** L'update sull'articolo porta `brand_id`, la delete
   sui tag che segue no. La riga vicina protetta fa sembrare protetta anche quella dopo.
2. **Il `WHERE` è scopato, il `SET` no.** Il corpo grezzo finisce nell'update: la riga si trova
   nel tuo brand e si riscrive col `brand_id` di un altro.
3. **Non c'è nessun `WHERE` da scopare: il tenant È il valore che arriva da fuori.**
   `insert({ brand_id: body.brandId })`. Qui non attraversa il dato, attraversa il **conto** —
   `credits.ts` somma quelle righe di `ai_calls`, quindi il consumo di uno lo paga un altro.

E il fallimento è muto in tutti e tre: **zero righe toccate non è un errore per PostgREST**,
quindi un update scopato che non trova niente lascia `error` nullo e il codice prosegue fino alla
scrittura non scopata che gli sta dietro. Un endpoint che risponde `200 {"ok":true}` su una riga
che non ha toccato è la stessa disonestà, un gradino più in basso.

Perché nessuno se n'era accorto: il cancello che sembrava un confine non lo era. `canEnter` si
descrive da sé come *«una porta commerciale, non un confine di sicurezza»* — chi leggeva la route
vedeva un `403` in cima e smetteva di cercare.

**La mossa.** `src/no-cross-tenant-writes.test.ts`, tre regole sul sorgente, una per forma. Non
sono state scritte per essere verdi: ognuna è stata provata sul sorgente **prima** della
correzione e ha trovato il proprio difetto lì — 1, 1 e 6 occorrenze. Una guardia che non è mai
stata rossa non dimostra niente, e ne abbiamo trovate cinque così in una sola giornata.

Niente allowlist: la prima regola incontra sette scritture di quella forma e sei sono sane, ma
un'allowlist da sei voci diventa un timbro alla settima. Le sei si sdoganano sul merito — una
lettura scopata che torna indietro, o `updateBrandRow`/`deleteBrandRow`, che contano le righe che
hanno toccato. Un update scopato che nessuno conta **non** vale come prova: quella riga sola è la
differenza fra la regola e un placebo.

Per il caso 3 la verifica sta in `ownsBrand` (`access.ts`): gira la domanda al database col client
dell'utente, dove le policy di `brands` rispondono con la stessa regola che `loadBrandForUser`
riapplica a mano. Un client non marchiato `markRlsScoped` riceve `false` — il default è il
rifiuto, così un percorso nuovo che si dimentica di marchiarsi resta chiuso invece di aprirsi.

Quattro occorrenze trovate solo perché qualcuno è andato a cercarle: la quinta arriverà, e allora
il costo di questa lezione è già stato pagato.
## Una policy permissiva può solo aggiungere accesso, e quella nata dalla dashboard non è in nessun file

Un red team ha scritto un file nella cartella di un altro utente sul bucket `media`, con un account
autoregistrato. In `supabase/migrations` non c'era niente di sbagliato: `media insert own folder`
(0004) chiedeva `(storage.foldername(name))[1] = auth.uid()::text` dal primo giorno. Accanto, creata
a mano dalla dashboard e in nessun file del repo, c'era `Allow authenticated uploads to media
bucket` — `with check (bucket_id = 'media')`, nessuna condizione sulla cartella.

**Segnale**: la policy stretta esiste, la leggi, sembra giusta, e l'attacco passa lo stesso. Oppure:
`npm run db:migrate` su un database pulito produce uno schema che si comporta **diversamente** dalla
produzione, e nessuno dei due è rotto.

**Mossa**: quando una policy «non difende», non rileggerla — **elencale tutte**, sullo stesso
oggetto:

```sql
select policyname, roles::text, cmd, qual, with_check
from pg_policies where schemaname = 'storage' and tablename = 'objects';
```

e confronta l'elenco con quello che le migration creano. Vale anche per i bucket
(`storage.buckets`): `email-assets` esiste in produzione e in nessuna migration.
`scripts/schema-drift-check.mjs` guarda tabelle e colonne, **non** policy e bucket.

**La regola dietro**: le policy permissive si sommano in **OR**. Una policy permissiva non può
restringere niente — la più larga vince sempre, e ogni policy stretta che le sta accanto è
decorativa. Quindi «aggiungo una policy più stretta» non è mai una fix: la fix è togliere la larga.
E un test che verifica una policy deve prima **ricreare la deriva** che la produzione ha davvero,
altrimenti misura un database che non è mai esistito e passa mentre il buco resta aperto.

## Una policy RLS vincola la riga, non la colonna

`profiles` aveva due policy e basta, e la seconda diceva `for update using (id = auth.uid()) with
check (id = auth.uid())`. Letta di corsa sembra completa: «puoi scrivere solo la tua riga». È vera,
ed è insufficiente — perché la riga contiene `approved_at`, che è il cancello della beta chiusa, e
`with check` non ha niente da dire su QUALE colonna stai scrivendo. `PATCH
/rest/v1/profiles?id=eq.<sé> {"approved_at":"..."}` risponde 200. La stessa forma su
`organizations` (`org owner all`, `ALL`, `owner_id = auth.uid()`) vale soldi: `plan = 'pro'` porta
la quota da 400 a 11.250 crediti senza passare da Stripe, perché `resolveOrgBilling` legge
`organizations.plan` per primo e non lo confronta con niente.

**Segnale**: una tabella con una policy `ALL` o `UPDATE` senza restrizione di colonna, e fra le
colonne almeno una che **decide un diritto** invece di descrivere un dato — `approved_at`, `plan`,
`status`, `activated_at`, `stripe_subscription_id`. Il confine che manca non è fra tenant: quello
regge. È fra ciò che un utente **possiede** e ciò che un utente **può decidere di sé**, e non
somiglia a un'intrusione perché è il proprietario che modifica il proprio oggetto — motivo per cui
un red team che attacca il confine fra clienti non lo trova.

**Mossa**: il livello che sa distinguere le colonne è il GRANT, non la policy. `revoke update on
<t> from authenticated` e poi `grant update (<colonne>) on <t> to authenticated`, con lo stesso
gesto su `insert` — una policy `ALL` lascia anche NASCERE una riga già `pro`. E l'elenco sta in UN
posto per tutte le tabelle, non uno per tabella: tre registri in tre file divergono al primo
cambiamento, e divergono in silenzio.

**La regola dietro**: quando si aggiunge una colonna, la domanda «chi la decide?» va posta prima,
non dopo. Il grant per colonna la pone da solo — una colonna nuova nasce non scrivibile, e il
percorso che ne ha bisogno si rompe subito e a voce alta. Il contrario (nasce scrivibile, e si
scopre quando qualcuno la usa) è il difetto che si è pagato qui due volte.

## Un `revoke` in una migration non è uno stato: è un evento

Le quattro `SECURITY DEFINER` senza controllo nel corpo — `brand_provider_spend_usd`, le tre
`agent_kit_*` — hanno tutte la loro `revoke ... from public, anon, authenticated` scritta nella
migration che le ha create. In produzione ha attecchito: otto combinazioni su otto false, verificate
con `has_function_privilege`. Sullo stack self-hosted locale, stesse migration, **otto su otto
vere**: `proacl` mostra `=X/...`, cioè PUBLIC con `execute`, su tutte e quattro.

**Segnale**: due database che dicono di avere le stesse migration applicate e rispondono in modo
diverso a `has_function_privilege('anon', '<fn>(...)', 'execute')`. Il record in
`app_schema_migrations` dice che il file è passato, non che il suo effetto è ancora lì: un
ripristino, una dashboard, uno strumento che ricrea la funzione e le rimette i grant di default
lasciano il record intatto e l'ACL no — e `db:migrate` non ripasserà mai su quel file.

**Mossa**: il grant si rimette, ma non è la difesa. La difesa è il filtro DENTRO il corpo, che
regge anche se il grant torna — la forma è in `20260905120000_secdef_least_privilege.sql`. E lo
stato vero si guarda in `pg_proc.proacl`, non nell'elenco delle migration applicate;
`npm run test:privileges` fa esattamente quella domanda contro un Postgres vero.

## `Test Files 1 failed` con `Tests 0 failed` è un worktree senza `.env`

Un worktree nuovo si porta dietro il codice, non l'ambiente. Senza `.env`, `hooks.server.ts`
esplode a tempo di import — `new URL(publicEnv.PUBLIC_SUPABASE_URL)` su una stringa vuota è
`TypeError: Invalid URL` — e `src/hooks.server.test.ts` non arriva a collezionare un solo test.

**Segnale**: il riepilogo si contraddice — `Test Files 1 failed | 681 passed` accanto a
`Tests 7516 passed`, zero test rossi. Un file che fallisce senza test falliti non è
un'asserzione: è un modulo che non si è caricato. Cercare l'asserzione rotta è tempo buttato.

**Mossa**: `cp <checkout-principale>/.env .env` nel worktree, come già si fa con `node_modules`
(stessa famiglia di trappola, poco sopra in questo file). E prima di dare la colpa al proprio
diff: `git diff --name-only origin/dev...HEAD` sul file incriminato — se non lo tocchi, non è tuo.
## Chiudere una tabella alla sessione non la chiude a una chiave API

`20261114_*` toglie ad `authenticated` ogni scrittura su `orgs_members`, `api_keys`, `node_runs`…
e il percorso più largo restava aperto: `/api/v1/org/rows` con una chiave `feega_…` gira con la
service role (`org-data/auth.ts`), impone solo `org_id`, e un member con una chiave in scrittura
si metteva owner con un `update_row`. Nessuna policy lo vede, perché la service role non le legge.

**Segnale**: un tool generico che scrive «qualunque tabella dell'org» e un `authority.kind ===
'service'` nello stesso percorso. **Mossa**: dopo ogni grant/policy, cerca chi scrive la stessa
tabella con la service role (`grep -rn "createServiceRoleDb\|createAdminClient"` e i tool
generici) e chiudi anche lì — qui `SERVER_WRITTEN_TABLES` in `org-data/tables.ts`. E per provare
la policy vera, `npm run test:billing-rls` carica in pglite l'intera `supabase/baseline` più le
migration successive: bastano gli stub di `auth`, `storage`, `realtime`, `stripe`, un
`jsonb_matches_schema` finto e `vector(1536)` letto come `text`.

## Un errore di scrittura non ha lo stesso codice del suo gemello in lettura

**Segnale.** Un ripiego copiato dal codice di lettura non scatta mai: il caso che doveva coprire
arriva, e il tool risponde con l'errore grezzo invece che col rimedio. Qui: `insert_row` doveva
riprovare senza `brand_id` sulle tabelle che non ce l'hanno, la condizione era `code === '42703'`
copiata da `query`, e ogni insert su `profiles` moriva dicendo «la colonna brand_id non esiste».

**Cosa succede.** PostgREST risolve i nomi di colonna in due posti diversi. In un **filtro** li
manda a Postgres, che risponde **42703**. Nel **corpo di una scrittura** li cerca nella propria
schema cache, e risponde **PGRST204** (`Could not find the 'x' column of 'y' in the schema cache`)
senza aver mai interrogato il database. Sono lo stesso fatto per chi scrive il codice e due codici
diversi sul filo, e il secondo non esiste affatto nel percorso di lettura da cui si copia.

**La mossa.** La domanda «questa tabella ha quella colonna?» si scrive **una volta sola**, in una
funzione che accetta entrambi i codici. Scritta due volte diverge alla prima, e diverge in silenzio:
il ramo mai preso non fallisce, semplicemente non c'è. E il caso si prova col codice VERO — un client
finto risponde quello che gli si dice, quindi un test scritto sul codice sbagliato è verde per
costruzione.

## `head: true` su una richiesta PostgREST si porta via anche il corpo dell'errore

**Segnale.** Un rifiuto che non si riconosce: `{"error":"db_error","message":""}`, senza codice e
senza testo, su una chiamata che poco prima funzionava.

**Cosa succede.** `select('*', { count: 'exact', head: true })` è la forma ovvia per contare senza
trasferire righe — PostgREST manda un `HEAD` e il conteggio sta in `Content-Range`. Ma un `HEAD`
**non ha corpo**, e il corpo è dove PostgREST mette `{code, message, details, hint}` quando la
richiesta fallisce: `supabase-js` consegna un errore con tutti i campi vuoti. Il conteggio riesce
benissimo; è il fallimento a diventare muto, quindi la sonda sembra corretta finché tutto va bene.

**La mossa.** Contare con `count: 'exact'` e `.limit(1)`. Una riga di traffico è il prezzo di un
messaggio d'errore leggibile, e un rifiuto anonimo costa molto di più: non si riconosce, quindi non
si spiega, quindi il giro dopo è identico al primo.

## Un vincolo nuovo rende raggiungibile ogni `catch` muto sulla stessa tabella

**Segnale.** Una funzione che ha sempre funzionato comincia a perdere dati, e nel diff del giorno
in cui è cambiata non c'è. Il commit che l'ha rotta è quello che ha aggiunto un `CHECK` a una
tabella che quella funzione scrive — e quel commit, da solo, era corretto.

**Cosa succede.** `sync_products` cancellava il catalogo del brand e poi inseriva quello nuovo,
senza leggere l'`error` di nessuna delle due scritture:

```ts
await supabase.from('products').delete().eq('brand_id', brand.id);
await supabase.from('products').insert(products.map(...));
return json({ ok: true, platform, synced: products.length });
```

Per mesi è stato un difetto **latente**: l'insert passava quasi sempre, quindi il `delete` senza
rete non si vedeva. Poi sono arrivati i `CHECK` su `products` — `products_title_check`,
`products_url_check`, `products_images_shape`, `products_text_len` — e i titoli e gli URL li
prende uno scraper da un sito che non controlliamo. Un prodotto senza titolo, o con `example.com`
invece di `https://example.com`, adesso fa fallire l'insert; ed è un INSERT solo con tutte le
righe, che in Postgres è atomico: **una riga malformata su quaranta e non ne entra nessuna**. Il
catalogo è già cancellato, e la risposta dice `synced: 47`.

Nessuna delle due PR poteva vederlo. Quella dei vincoli guardava se i valori erano validi, non chi
leggeva l'errore quando non lo erano. Quella della sincronizzazione è di mesi prima, quando quel
fallimento non esisteva. **Le due cose si scrivono in PR diverse, da persone diverse, e la
combinazione non è il diff di nessuna delle due.**

**La mossa, in tre parti.**

1. **Quando aggiungi un vincolo a una tabella, cerca chi ci scrive senza leggere l'`error`.** È
   un `grep` sulla tabella, non una revisione: `from('<tabella>')` seguito da `insert`, `update`,
   `upsert` o `delete` di cui nessuno guarda l'esito. Quella lista è l'elenco dei difetti che il
   tuo vincolo ha appena reso raggiungibili, e va nella stessa PR o in quella subito dopo.
2. **Cancellare e riscrivere non si fa in quest'ordine.** PostgREST non ha transazioni, quindi
   `delete` + `insert` sono due viaggi e il fallimento del secondo lascia fatto il primo. Si
   inserisce prima e si cancella il vecchio dopo: un insert che fallisce lascia il catalogo di
   prima esattamente dov'era. Per un istante esistono entrambi gli insiemi — va verificato che
   nessun vincolo unico lo vieti e che i lettori siano `select`, ma un conteggio doppio per una
   frazione di secondo non si paragona a un catalogo perso.
3. **La riga malformata non deve far cadere le altre, e non si scarta in silenzio.** Il lotto che
   fallisce si ritenta riga per riga: chi passa entra, chi no torna al chiamante **col motivo che
   ha dato il database**. I vincoli non si riscrivono in TypeScript per filtrare prima — una
   regola scritta in due posti diverge al primo cambiamento della migration, e qui il posto giusto
   è uno solo: la migration li dichiara, Postgres giudica.

**Perché il test non è in vitest.** La suite mocka Supabase e un insert finto accetta qualunque
cosa, quindi il vincolo lì è verde per costruzione. Che i `CHECK` mordano davvero lo prova
`scripts/constraint-harness.mjs` contro un Postgres vero. Quello che invece vitest **può** provare,
ed è il difetto vero, è l'**ordine**: con la scrittura che fallisce, il catalogo di prima deve
essere ancora in tabella e la risposta non deve dire `synced`. Un test del solo percorso felice non
vede niente di tutto questo — è per quello che il difetto è arrivato fin qui con la suite verde.

---

## Un mock che finge il trasporto sbagliato è una suite verde su codice mai eseguito

**Il segnale.** Un test che mocka un fornitore e passa, ma impiega **secondi** invece di
millisecondi. Il tempo è la spia: se il mock intercettasse davvero, non ci sarebbe niente da
aspettare. Quei secondi sono la rete vera, chiamata da un ramo che nessuno stava guardando.

Successo due volte nella stessa sessione, sullo stesso file. Prima il commento in cima a
`craft-floor.test.ts` lo raccontava già: *«prima si fingeva `{ endpoint: 'google' }` — un endpoint
che il registro non sa produrre — e si leggevano i prompt dal ramo Google, che nessuna richiesta
poteva raggiungere»*. Poi di nuovo, spostando gli stessi test da kie a OpenRouter: la rotta finta
diceva `openrouter`, ma il bivio vero si sceglie **sul modello**, e nano-banana passa dall'API
immagini, cioè da un secondo trasporto che il mock non copriva.

**Cosa ha nascosto.** Il ramo non misurato tornava il render **senza passare da `review()`**,
mentre gli altri due lo chiamavano. Il cancello che blocca il logo del brand stampato su un capo
d'abbigliamento era scavalcato su ogni modello servito da quell'API. Il test che lo prende era
già scritto e già rosso — asseriva contro un mock che il codice non raggiungeva più, e nessuno
poteva vederlo finché il mock non è stato rimesso sul percorso giusto.

**La mossa.**

1. **Quando un bivio si sceglie su un dato e non sulla rotta, il test finge TUTTI i rami.** Un
   `route: () => 'openrouter'` non basta se poi è `imageModelSpec(model)?.openrouterImages` a
   decidere la porta. Fingerne uno solo misura il prompt del ramo che non è stato preso.
2. **Il tempo del test è un'asserzione implicita: leggilo.** Millisecondi = intercettato. Secondi
   = stai pagando una chiamata vera, e quello che credi di misurare non è quello che misuri.
3. **Quando due rami fanno la stessa cosa e uno ha un passaggio in più, è il ramo corto il
   difetto** — non la simmetria da ripristinare per eleganza. Qui `review()` mancava, e mancava
   sul ramo che stava prendendo tutto il traffico.

---

## `res.ok` non dice che una action ha salvato

**Il segnale.** Il client dichiara successo a ogni operazione, e la tabella resta vuota. Nessun
errore da nessuna parte: né in console, né nei log del server, né in Postgres. Scoperto solo
guardando il conteggio delle righe — 1 tela, 0 tile, dopo giorni di trascinamenti.

**La causa, in due strati che si coprono a vicenda.**

1. `fetch('?/move', { method: 'POST', body: fd })` **non è una chiamata a una action.** Senza
   l'intestazione `x-sveltekit-action`, SvelteKit lo tratta come l'invio di un form non
   potenziato e risponde **303 verso la pagina**. `fetch` segue i redirect da solo, quindi torna
   l'HTML della pagina con `res.ok === true`. La action non è mai stata invocata.
2. Anche invocandola, **una action risponde 200 anche quando rifiuta.** L'esito sta nel corpo
   (`type: 'success' | 'failure' | 'error'`), da leggere con `deserialize` di `$app/forms`. E
   rifiutare con `json({...}, { status: 400 })` non basta: è una `Response`, non un esito di
   action, e `deserialize` la legge come successo. Il rifiuto si dichiara con `fail()`.

**La mossa.**

- Una action chiamata a mano vuole **l'intestazione** e la **lettura del corpo**. Due cose, non
  una: con la sola intestazione si leggono i fallimenti come successi, con la sola
  deserializzazione si legge l'HTML di una pagina.
- **`res.ok` su una action non è un'asserzione.** Vale 200 quando salva, 200 quando rifiuta e 200
  quando non è stata nemmeno chiamata: i tre casi che serve distinguere sono esattamente quelli
  che confonde.
- **Il test che lo prende non è sul server.** `saveCanvasPositions` aveva dieci test verdi e
  funzionava: il difetto stava nel fatto che nessuno la chiamava. Quando una scrittura "non
  arriva", **conta le righe** prima di leggere il codice che le scrive — è la misura che dice se
  stai cercando nel posto giusto.

## Una rinomina globale spegne i valori che i clienti hanno già in mano

`anomalia.so` è diventato `dazero.co` con una sostituzione a testo su 562 file. Due punti non
erano prosa, e la sostituzione cieca li ha rotti senza che niente diventasse rosso.

**Il segnale.** Un `grep` del nome vecchio torna 0 e la suite non peggiora, ma un valore che
vive FUORI dal repo — una chiave emessa, un file in `~/.config`, un cookie, una riga già
scritta a database — continua a portare il nome vecchio. Nessun test lo vede, perché nessun
test possiede quel valore.

**La mossa.**

- **Un prefisso già emesso si aggiunge, non si sposta.** `cli-auth.ts` riconosceva `anomalia_`
  e, di fianco, `021_live_`: il prefisso di una rinomina precedente, tenuto apposta. La
  sostituzione ha riscritto il primo e lasciato il secondo, e ogni chiave in mano ai clienti
  sarebbe caduta in 401 — un guasto muto, perché un 401 sembra una chiave sbagliata, non una
  rinomina. La presenza di un prefisso legacy accanto a quello nuovo **è la prova che il
  problema si era già presentato**: leggila come tale invece di sostituirla.
- **Prima di sostituire, cerca i confronti su letterali**, non solo le occorrenze:
  `grep -nE "(startsWith|includes|===)\s*\(?\s*['\"][^'\"]*<nome>"`. Un letterale dentro un
  confronto è un valore che qualcuno possiede altrove; una stringa in prosa no.
- **Il minuscolo del marchio vale in prosa, non dove decide la lingua.**
  `class Anomalia < Formula` è diventato `class dazero < Formula`: Ruby vuole la costante
  maiuscola, e la formula Homebrew non è coperta da test perché non è codice che gira qui — si
  sarebbe rotta al primo `brew install`. Dopo una rinomina case-preserving, ricontrolla le
  posizioni dove la maiuscola è sintassi: dichiarazioni di classe, componenti, costanti.

### Un bucket Storage creato a mano nel dashboard non esiste sul prossimo progetto
Ogni run immagine del canvas falliva `store_failed`, sempre — il modello rispondeva (40-70s
reali), il deposito no. `select id from storage.buckets` sul progetto nuovo
(`klnswzhhgrqvbfjzioul`) tornava **zero righe**: né `brand-knowledge` (la cui migration,
`0021_brand_documents.sql`, è scritta per il database vecchio e non è mai stata riapplicata al
nuovo) né `canvas-assets` (mai avuta una migration — creato a mano nel dashboard secondo
MIGRATION_PLAN.md fase 2, lo stesso difetto che `20260905140000_storage_tenant_isolation.sql`
documenta già per `media` ed `email-assets`). Un `create bucket` dal dashboard vive SOLO su quel
progetto: la prossima volta che qualcuno punta il codice a un progetto Supabase pulito — un nuovo
ambiente, un branch di sviluppo, un progetto ricreato dopo un incidente — ogni scrittura che
presume quel bucket fallisce dal primo secondo, silenziosamente se l'errore non è propagato (v.
sotto). Segnale: OGNI operazione su un percorso torna lo stesso errore generico, e
`select * from storage.buckets` (letto in sola lettura, zero rischio) torna una riga in meno di
quante ce ne aspetti. Mossa: `insert into storage.buckets (...) on conflict do nothing` +
le sue policy vanno SEMPRE in una migration versionata, mai solo nel dashboard — è la stessa
regola di ogni altro oggetto dello schema, e qui costa un prodotto che sembra funzionare
(il turno termina, nessuna eccezione) e non produce mai niente.

**E l'errore di storage va propagato, non schiacciato su un token generico.** La catena
`storeBrandMediaBytes → storeDrawing → handOverImage/depositImage → runImageJob` restituiva
`{ error: message }` al primo livello e un `null` nudo a ogni livello sopra: un bucket assente,
una scrittura respinta dalla RLS e un campo del provider mancante finivano tutti sullo stesso
`store_failed`, e da UI erano indistinguibili. Mossa: ogni funzione che può fallire per più di un
motivo torna QUALE motivo, fino al punto che lo scrive per chi guarda — un token enum senza un
messaggio accanto è debuggabile solo da chi ha il database aperto.

### Un `select`/`insert` su una colonna non ancora migrata risponde 42809, non 42703
Il loop mode aggiungeva `nodes_connections.mode` — pensata, testata, scritta in una migration
(`20260923_loop_nodes.sql`) — e il codice la leggeva/scriveva già, prima che qualcuno applicasse
quella migration. Ogni apertura della tela finiva 500: non il 42703 ("colonna inesistente") che
ci si aspetterebbe, ma **42809**, perché Postgres ha una funzione aggregata ordinata che si
chiama anche lei `mode` — `select ... mode` senza la colonna risolve sul nome della funzione, non
su un errore di colonna mancante. Lo stesso identico guasto sarebbe stato invisibile a un
`grep` per "colonna non esiste": il messaggio non lo dice.

Segnale: un `SELECT`/`INSERT` che nomina esplicitamente una colonna appena aggiunta a una
migration rompe OGNI riga letta da quella tabella, non solo quelle che userebbero il campo nuovo
— e se il nome scelto coincide con una funzione SQL, l'errore mente sulla causa.

Mossa, diventata regola per il resto del task: **il codice vivo non dipende MAI da una
migrazione non ancora applicata.** Si scrive la migration, si scrive il repo/adapter che la
userà, ma la SELECT/INSERT reale resta com'era (default sicuro, es. `mode: 'fixed'` sempre)
finché la migration non è confermata applicata — con i test che coprono il comportamento nuovo
marcati `it.skip('... [in attesa di <nome_migration>.sql]')`, non cancellati: il nome della
migration nel titolo del test è quello che dice a chi la riattiva cosa sbloccare. `node scripts/
schema-drift-check.mjs` confronta col database VERO prima di ogni commit che tocca lo schema —
va eseguito prima di fidarsi che una colonna nuova sia già leggibile, non dopo che va in
produzione.

### Una guardia `auth_org_ids()` in una funzione SECURITY DEFINER azzera le chiamate del server
Segnale: una RPC restituisce 0 o vuoto con la chiave di servizio, e il dato vero nella tabella c'è
(il saldo crediti era 0 con 1.000.000 di crediti a ledger, e ogni generazione veniva rifiutata per
"crediti esauriti"). `auth_org_ids()` legge l'utente dal JWT: con la service-role non c'è utente,
l'insieme è vuoto, la condizione è sempre falsa. Mossa: la guardia diventa
`(auth.role() = 'service_role' or _org_id in (select auth_org_ids()))`, e si verifica nei due
sensi: il server vede il dato, un utente estraneo (`set local role authenticated` + claims) no.
Leggere sempre la definizione IN PRODUZIONE (`pg_get_functiondef`), non il file: questa guardia
era stata aggiunta al database e mai scritta in una migration del repo.

### `Cannot find module '@dazero/…'` o di un pacchetto transitivo dopo un `bun install`
Segnale: il dev server e metà della suite muoiono su `@dazero/api-contracts`, `intl-messageformat`
o simili, e `node_modules/.bun/` esiste. Bun 1.3 in un repo con `workspaces` installa con il
linker "isolated": collega solo le dipendenze dichiarate, quindi spariscono i workspace (la root
non li dichiara) e ogni transitivo importato direttamente. Mossa: `bunfig.toml` fissa
`linker = "hoisted"`, poi `bun install`. Non aggiungere dipendenze una per una: è il layout, non
il codice.

### Edit non committati nel working tree condiviso finiscono nel commit di un altro agente
Segnale: più agenti lavorano nello stesso checkout (non un worktree a testa), e `git status`
mostra file di un altro agente accanto ai propri — nessuno stash coinvolto, basta che i tuoi
edit restino non committati mentre lui fa `git add`/`commit` prima di te. Mossa: committare il
proprio lavoro presto e per file espliciti (`git add <path...>`, mai `-A`/`.`), e prima di ogni
commit lanciare `git diff --cached --name-only` come comando SEPARATO e leggerlo — se compare un
file che non hai toccato, esce dallo staging prima del commit, non dopo.

### Un pathspec con `[` o `]` (le rotte dinamiche di SvelteKit) puo' non far match, in silenzio
Segnale: `git add src/routes/p/[projectId]/c/[canvasId]/+page.svelte` non da' errore ma il file
resta fuori dallo staging — git tratta `[...]` come una character class glob, e `projectId` non
la soddisfa mai. Mossa: `git add ':(literal)src/routes/p/[projectId]/c/[canvasId]/+page.svelte'`
— il prefisso `:(literal)` disattiva il glob e fa matchare il percorso byte per byte.

### Un modulo client-safe dentro `$lib/server/` rompe la build, non un test
`import { billedCreditsFor } from '$lib/server/credit-ladder'` in `ads-fee.ts` (universale,
importato da un `+page.svelte`) — nessun test lo copre perché ogni test lo importa lato server,
dove la guardia di SvelteKit non gira. In produzione la build fallisce ("Cannot import
$lib/server/credit-ladder.ts into code that runs in the browser") e il deployment non nasce mai:
il 500 `FUNCTION_INVOCATION_FAILED` che l'utente vede è l'alias che punta a un deployment
inesistente, non una funzione che crasha a runtime. Segnale: `vercel inspect <url> --logs` mostra
l'errore `vite-plugin-sveltekit-guard` durante `npm run build`, non uno stack a runtime; l'unico
deployment "Production" è in stato Error. Mossa: `credit-ladder.ts` non ha segreti — è prezzo
puro (costanti + funzioni) — quindi va spostato fuori da `$lib/server/` (`$lib/credit-ladder.ts`)
invece di duplicare la logica lato client. Prima di mettere qualcosa sotto `$lib/server/`,
chiedersi se un componente lo importerà mai: se sì e il contenuto è client-safe, non ci va sotto.

### Una pagina dà 500 su Vercel e in locale no: `ReferenceError: DOMMatrix is not defined`
Segnale: nei log di produzione (`vercel logs <deployment> --json`, in streaming: vanno aperti PRIMA
di ricaricare la pagina) un `ReferenceError` di un'API del browser dentro `node_modules/pdfjs-dist`
(o simili), mentre si carica il modulo della rotta. Una libreria per PDF importata in cima a un
modulo server la carica all'avvio della funzione, e in Node `DOMMatrix` non esiste. Mossa:
`await import('libreria')` dentro la funzione che la usa, e un test che importa il modulo e
verifica che la libreria non si carichi.

### Un indice unico PARZIALE non può mai essere il bersaglio di un upsert PostgREST — `42P10` anche quando l'indice esiste
`upsertNodeProducts`/`insertBrandProducts` chiamavano `.upsert(rows, { onConflict:
'node_id,platform,external_id' })`, e ogni sync di un nodo `products` tornava 500 con `42P10:
there is no unique or exclusion constraint matching the ON CONFLICT specification`. L'indice
ESISTEVA — verificato via SQL diretto (`pg_indexes`), e un `INSERT ... ON CONFLICT (node_id,
platform, external_id) WHERE node_id IS NOT NULL` via connessione Postgres diretta risolveva
senza errore. La stessa identica lista di colonne via `supabase-js` (cioè via PostgREST)
falliva comunque. La causa: PostgREST genera SEMPRE `ON CONFLICT (colonne) DO UPDATE` senza
`WHERE`, e Postgres fa combaciare un `ON CONFLICT` solo con un indice la cui definizione è
IDENTICA — un indice parziale non matcha mai quella forma, qualunque sia il nome o le colonne.
Segnale: `42P10` da `supabase-js`/PostgREST anche dopo aver confermato che l'indice esiste ed è
scritto giusto via SQL diretto — la discrepanza tra "SQL diretto passa" e "REST fallisce" è la
prova che il problema è la clausola `WHERE`, non l'indice in sé. Mossa: un indice unico dietro
un `onConflict` chiamato da `supabase-js`/PostgREST non può MAI essere parziale — se la
protezione serve solo quando una colonna non è nulla, un indice pieno basta comunque, perché
Postgres non considera mai due NULL uguali in un indice unico normale: la partialità qui non
aggiungeva niente che l'indice pieno non desse già.

## Un `upload` con `upsert: true` chiede SELECT e UPDATE, non solo INSERT
Segnale: `new row violates row-level security policy` su un upload a un percorso per cui la
policy INSERT c'è ed è giusta. Lo Storage fa `insert ... on conflict do update`, e Postgres
valuta anche le policy SELECT e UPDATE — anche al primo caricamento, senza conflitto. Mossa: per
ogni cartella scritta con `upsert: true`, una policy SELECT e una UPDATE (using + with check)
accanto alla INSERT. La suite non lo vede: il fake dello storage risponde sempre ok.

## Green locally, red in CI: the test was reading `.env`

**Signal:** a test passes on your machine and fails in CI with "not configured", or a spy "called 0 times" where the code quietly took a fallback. SvelteKit loads `.env` into `$env/*` for Vitest too, so local runs see real keys that CI never has.
**Move:** reproduce with `.env` set aside (`mv .env .env.x`, run, move it back), then mock the boundary that reads env (`craft-model`, `createAdminClient`) or move the env read inside the fail-open `try`.

## Production logs show fixture ids (`org-1`) failing a uuid cast

**Signal:** Postgres logs `invalid input syntax for type uuid: "org-1"` in bursts that match
someone's test run, not user traffic. Vitest loads `.env`, and a fail-open path (credit gate,
brand lookup) sent the fixture to the live project without failing the test.
**Move:** `src/test/no-live-supabase.ts` fails any test that reaches `*.supabase.co`; mock the
boundary it names (`gateOrgAiActionForForm`, `createAdminClient`, `orgCreditBalance`).

## Supabase Storage `createSignedUrls` (batch) silently ignores `transform`

**Signal:** a thumbnail request via the batch signer returns full-size bytes, no error, no type
error either (the installed `storage-js` types don't even declare `transform` on the batch
overload — only on `createSignedUrl` singular). Only a real curl of the returned URL, comparing
byte sizes, catches it; a green test against a mock never would.
**Move:** sign per-path in parallel with `createSignedUrl` when a thumbnail transform is needed;
reserve the batch call for full-size, no-transform signing. `signThumbnailUrls`
(`src/lib/server/media-thumbnails.ts`) is the one place that decides which.

## `npm run db:types` truncates `database.types.ts` on auth failure

**Signal:** the file is 0 lines after a failed `db:types` run in a sandbox with no Supabase
access token. `> file` opens and truncates the file before the command runs, and
`supabase gen types` fails after that — the shell redirect wins the race, not the command.
**Move:** `git checkout -- src/lib/database.types.ts` before editing by hand when `db:types`
fails; never trust the file's presence after a failed run without checking `git status` first.

## A partial save still reverts someone else's field

**Signal:** after a burst of edits a key another writer changed (`refId`, `runId`) is back to
an older value, while other keys from the same writer survived. The client diffed the
optimistic `next` against the last server-confirmed data: a caller that passes the whole gen
state carries a stale `refId`, and that diff sees it as a change.
**Move:** diff `next` against what the tile showed when the user acted (the user's intent);
use the server-confirmed data only as `base` for the same-key conflict check.

## A "no paths, nothing to do" check moved past the eager call it was guarding

**Signal:** a real signup path that never needed storage (no reference images this turn) throws
inside a helper that touches `db.storage`, caught by an outer try/catch far away — a `done`
outcome quietly becomes `refused`, and the failing assertion is nowhere near the actual cause.
Only a test whose fake db has no `.storage` at all catches it; one with an empty-but-present
`.storage` stub would pass and hide the bug.
**Move:** when refactoring `if (!input.length) return empty` out of several call sites into one
shared function, check whether any call site still builds the expensive/unavailable-in-tests
argument (a bucket, a client) BEFORE calling the shared function — pass a factory (`() => X`)
instead of `X`, so the empty check can run before that argument is ever constructed.

## A real check against `vite dev` shows no change after an edit

Signal: a server-side edit (a tool, a port) has no effect in agent turns, and nothing new lands in
storage, while unit tests pass. The dev server kept the old module for turns running in the
background. Move: restart `vite dev` after server edits before trusting a real-check run.
In a worktree under `.claude/worktrees/` the watcher sees no edit at all, client files included
(the path has a dot folder): `curl` the module from the dev server and grep the change before
blaming the code. Also check who owns port 4173: `reuseExistingServer` runs your specs against
another worktree's server (`lsof -a -d cwd -p <pid>`). Move: own port (`E2E_BASE_URL`), restart
after every edit.

## `/login` answers 500 on a worktree dev server with a symlinked `node_modules`

Signal: `Cannot find module '.../intl-messageformat/lib/src/core'` in the vite log; every
real-stack e2e times out on the login placeholder. Cause: through the symlink vite SSR loads the
package's ESM `module` entry. Move: `npm ci` in the worktree before a real-stack run.

## A worktree dev server keeps serving the old module

**Signal:** edits to a `.svelte` or `.ts` file change nothing in a Playwright run against `vite dev` started in a worktree; `curl localhost:PORT/src/...` shows the old source; before/after A/B runs agree because both ran the same stale code. **Move:** restart the dev server for every variant (`scripts/bench/editor-scrub.ts` runs against a fresh one) and grep the served module for a marker before trusting a comparison.

## A worktree dev server ignores your edits

**Signal:** a `console.log` you just added never shows; `curl` of the module from vite lacks it. **Move:** vite does not watch files under `.claude/worktrees/`; restart the dev server after every edit.

## `npx prettier --write` rewrites whole files

**Signal:** a small diff becomes thousands of lines, single quotes turn double. **Move:** the repo has no prettier config; never run prettier. Lost edits staged once survive as unreachable blobs: `git fsck --unreachable --no-reflogs`, match by identifier set.

## An agent worktree's dev server serves old code for files it already loaded

**Signal:** a new file shows up in the browser but your edit to an existing module (a `.svelte` the page already imported) does nothing, no error. **Cause:** `server.watch.ignored` skips `**/.claude/worktrees/**`, so Vite never invalidates anything inside a worktree. **Move:** restart the dev server after editing an existing module; new files are fine.

## A migration-only PR leaves derived files stale and `dev` red

Signal: CI `test` fails on `query-tool.test.ts` (query-tables.ts), `write-tool.test.ts` (write-rules.ts) and `cli/lib/contracts.test.ts` right after a PR that only adds a migration. Cause: those files are generated from the migrations and the PR never regenerated them. Move: `node scripts/query-tables-from-migrations.mjs --write && bash cli/scripts/sync-contracts.sh`, commit the four files with the migration.

## Unit tests fail in a worktree only after a demo or e2e run copied `.env` into it

**Signal:** `robots.txt`, `sitemap.xml`, `credits` and `/api/v1/motion/[nodeId]/embed` server tests go red in a worktree that was green, with no code change near them. **Move:** a worktree has no `.env`; copying the main one in to run a demo or the dev server makes `$env` values real and those tests read them. Move `.env` aside (`mv .env .env.bak`) for the unit run, put it back for the demo, and delete it with the worktree.

## Worktree tests resolve @feega/* from the main checkout

Signal: a test of code under `packages/` hangs or ignores your edit in a worktree whose `node_modules` is a symlink; `svelte-check` says the new module does not exist. Cause: `node_modules/@feega/*` are relative symlinks, resolved from the real path, so they point at the main checkout. Move: a scratch vitest config that merges `vite.config.ts` and aliases `@feega/motion-core/(.*)` to `packages/motion-core/src/$1` (and a scratch tsconfig with the same `paths` plus `$lib`); do not commit them.

## A new column written before its migration breaks every write, silently in Vercel

**Signal:** every save shows "The server failed to save this change", Vercel logs are empty, `schema-drift-check` lists an unapplied migration. **Move:** new optional columns/RPC args are written with a fallback (retry without on PGRST202/PGRST204/42703), and `handleError` must `console.error` — Sentry's wrapper alone shows nothing in Vercel. Migrations merged to `dev` are applied to production (which `dev` uses) before the user tests `dev`.

## A probe script outside the worktree runs old package code

**Signal:** a fix to `packages/motion-core` passes its unit test, but a `vite-node` script you keep in the scratchpad still prints the old numbers, and a debug log you add never shows. **Move:** imports such as `@feega/motion-core/...` resolve from the nearest `node_modules` up the script's path, which may be a stray install, not your worktree. Keep probe scripts inside the worktree (an ignored folder) so they resolve the code you are editing.

## A dev server started inside an agent worktree never reloads

**Signal:** `vite dev` runs from `.claude/worktrees/<agent>`, a source edit is on disk, yet the served module (`curl` its URL) still lacks it and debug logs never print. **Move:** `vite.config.ts` ignores `**/.claude/worktrees/**` in the watcher, which matches every file of that checkout. Restart the server after each edit, or start it with a scratch config that spreads the repo config and replaces `server.watch.ignored`.

## A dialog that closes itself before reading its props throws in silence

**Signal:** clicking the action in a dialog closes it and nothing happens; `pageerror` says `Cannot read properties of null (reading 'history')`, no network request, no notice. **Move:** the handler called `onclose()` and then read props derived from the dialog's own state (`session`, `doc`); closing unmounts the component and the props turn null. Read and compute everything first, close last (`insertThenClose`); capture what a later `await` needs before closing.


## A derived reruns on every tick although none of its inputs changed

**Signal:** a `$derived` (or a template expression with a call) runs about once per camera tick while an `$effect` watching each of its inputs sees them change a handful of times. **Cause:** Svelte 5 (5.56 and 5.57) keeps a derived's write version when it recomputes to an equal value; once one input changed while its value did not, `is_dirty` finds that input newer on every later `MAYBE_DIRTY` mark and reruns it. Marks travel through deriveds: any derived that reads `view` (`tier`, `labelZoom`, `liveCode`) marked the whole card and frame graph on each tick. **Move:** a camera-driven value that feeds other state is plain `$state` written by `$effect` (it bumps only when the value changes), never a `$derived` of `view`. Not `$effect.pre`: it runs at its declaration, so a `const` declared further down the script is still in its TDZ and the component throws on mount. To find the source, hook `internal_set` in the prebundled Svelte chunk (`.vite-deps/deps/chunk-*.js`, restart the server) to record written sources, then walk `.reactions` from each to the rerunning derived. Guard: `a pan after a change that left the waiting count alone walks none of them` in `core-frames-camera.svelte.test.ts`.

### `svelte-check` dies in a worktree with an esbuild goroutine dump

**Signal:** `npx svelte-check` in a `feega-wt/` worktree prints `Error while loading config at …/packages/feega-motion-react/example/vite.config.ts` and a Go stack, exit 0, no diagnostics. **Move:** it is the example's config failing to load, not your code; type-check the TypeScript with `npx tsc --noEmit -p tsconfig.json | grep <your paths>` and let a dev server compile the `.svelte` files you touched (open the page), then trust CI's check.

## A dev server spawned by feega outlives it

**Signal:** `ps` shows `npm exec vite dev --port <n>` with parent pid 1 after the feega server stopped; the desktop app needs its SIGKILL fallback to close the local server. **Move:** a non-detached child keeps the parent's event loop alive and does not die with it, and `child.kill()` reaches only the npm wrapper. Spawn through `spawnGroup` (`code-import/dev-children.ts`): own process group, `kill(-pid)` on release, exit and signals, pid file for the next start. Test with a fake `npm run dev` that spawns a grandchild, and assert the grandchild's pid is gone.

## A browser run on a worktree dev server goes strange the moment a file is saved

**Signal:** mid-run the page loses state (a pending import shows nothing, a panel vanishes, a map entry is missing), and the dev server log shows `page reload .svelte-kit/generated/client/...` at the same second as an edit to any file in the worktree, docs and changelogs included. **Move:** never edit the worktree while a Playwright run drives its dev server; write notes and PR text in the scratchpad, edit after the run, and redo the run from a fresh canvas file.

## A CI audit matrix holds runners for hours when one row wedges the page

**Signal:** `ci.yml` `test` sits queued while `audit (…)` jobs run past an hour; the audit log shows the same `locator.click: Timeout 3000ms exceeded ... waiting for element to be visible, enabled and stable` on every row, about 2 minutes apart. **Move:** a run that is not required must still be bounded: `timeout-minutes` from a measured run, `max-parallel` on the matrix, and a circuit breaker in the spec (`unreachedRows` in `inspector-audit.spec.ts`) so one wedged page fails the rest at once instead of timing out row by row.

## A service-role credential carries no role unless the request re-derives it
**Signal:** a token row (`api_keys`) is checked for hash, revocation and expiry, then the request runs on the service-role client. RLS role rules (viewers read-only) do not apply, and a demotion or removal changes nothing for the token. **Move:** derive the effective scopes from the holder's current membership on every request (`scopesOfHolder`); never trust what was stored at mint time.


## A worktree sees the main checkout's workspace packages, and `vite dev` misses in-place edits

**Signal:** a test for an edited `packages/*` file keeps seeing the old schema (zod `.strict()` rejects a new field) although the worktree file is right; or a dev server keeps serving a styled component as it was before a `perl -pi` edit. **Move:** make `node_modules` a real directory of symlinks and point `@feega/*` at the worktree's own `packages/` (a plain symlink to the main `node_modules` resolves them in the main checkout); restart `vite dev` after a scripted edit, it does not always notice a replaced file.

## `wrangler dev` answers 404 on every `<sid>.localhost` request

**Signal:** the relay returns its own `not found` for `http://<sid>.localhost:8799/` while `env.VISITOR_BASE` is set. With `routes` in `wrangler.toml`, local mode rewrites `request.url` and `Host` to the first route's host, so the sid never reaches the Worker. **Move:** `wrangler dev --local --infer-origin-from-routes false`.

## A Workers test WebSocket delivers binary frames as Blob

**Signal:** a test peer gets `event.data` as an object with no `byteLength` and every decoded frame is `null`. **Move:** set `socket.binaryType = 'arraybuffer'` before `accept()` in the test harness.

## Feega Inspect

### Every file read in `fileEdits` answers null though the file exists

**Signal:** an edit or a project-wide rewrite says "not named in any source file" / "not a file inside the workspace" in the panel harness, while the same code passes in unit tests. **Move:** `inside(root, path)` compares against `normalize(root) + sep`, so a root with a trailing slash never matches. Pass the app root without the trailing slash (`fileURLToPath(new URL('../fixtures/vite-react', import.meta.url))`).

## The preview opens a stranger's server: a planned port is not a served port

**Signal:** the preview or the status-dot menu shows a port that is not the one the dev server prints. A free port is probed, released, then the framework starts (Astro and Nuxt step to the next port when it is taken); a readiness check that accepts "something listens on the planned port" accepts the stranger. **Move:** readiness takes the port from the server's own printed URL; the planned port counts only when the listener's cwd is the app. The menu derives from the one URL the preview loads, never from the plan.

## A fixture package.json changes by itself after the first run

**Signal:** a framework e2e fails with `package.json` in the changed files. React Router adds `isbot` to the app when it is missing, and the test cleanup then reverts your uncommitted fixture edit. **Move:** declare the dependency the framework wants in the committed fixture, and commit fixture edits before running the e2e.

## Astro compiler offsets are UTF-8 bytes

**Signal:** raw `data-feega-src="..."` shows as visible text in the middle of words on an Astro page, only after the first non-ASCII character (`·`, `€`, accents) in the file. **Move:** convert `position.start.offset` from bytes to string indices before inserting, and keep a non-ASCII case in the Astro stamping test and fixture.
