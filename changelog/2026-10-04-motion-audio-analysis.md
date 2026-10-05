# Motion editor: analisi audio sul server

Ogni asset audio/video usato in un video motion viene analizzato sul server una volta:
inviluppo d'ampiezza (un valore per frame, normalizzato a 1), onset, BPM e griglia dei beat,
regioni di parlato. Il risultato sta accanto all'asset, `canvas-assets/<org>/<project>/analysis/<assetId>.v<N>.json`:
la versione è nel nome, quindi cambiare l'algoritmo (`ANALYSIS_VERSION`) rifà le analisi senza
migration. Scartata una colonna jsonb su `assets`: i deploy non applicano le migration e il codice
avrebbe letto una colonna che in produzione non c'è.

**Algoritmo** (`src/lib/motion/audio-analysis.ts`, puro e deterministico). Decodifica con ffmpeg
in mono 22 050 Hz. Energia su finestre da 10 ms; un onset è un salto di log-energia > 1.5
rispetto alla media dei 50 ms precedenti (non della sola finestra prima: un pad con battimenti
lenti produceva onset finti ogni 0.2 s), sopra -40 dB dal picco, massimo locale, almeno 100 ms
dal precedente. Tempo: autocorrelazione degli onset come impulsi unitari (la forza grezza faceva
pesare l'attacco dal silenzio più di tutti i colpi) fra 60 e 200 BPM interi, pesata verso 120 (una
gaussiana in ottave) per non scegliere la metà o il doppio. Griglia: la fase che somma più onset.
Provato su una base sintetica a 120 BPM con pad e hi-hat: 120 BPM, primo beat a 0.19 s (vero 0.2). Parlato: finestre sopra
-30 dB dal picco, pause sotto 0.3 s unite, regioni sotto 0.15 s scartate — è un rivelatore di
attività, adatto a un voice-over, non distingue la voce dalla musica.

**Dove si usa.** La forma d'onda della timeline ora è l'inviluppo (prima: decodifica nel browser
di ogni file a 20 picchi/s; `loadPeaks`/`peaksOf` rimossi). Il ducking usa le regioni di parlato
del voice-over invece dell'intera clip. Agente: `analyze_audio`, e `duck_audio` passa dalle
stesse regioni. Percorso: `+page.svelte` (`analyse`) → action `?/analyze` → `analyzeSounds` →
storage.
