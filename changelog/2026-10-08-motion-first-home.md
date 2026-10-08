# /app motion-first

feega si specializza nella motion. `/app` era una dashboard di progetti, tool e output, e un
nuovo utente atterrava su una tela vuota.

- **Home**: un campo "Paste your URL or describe your video". L'action `video` in
  `src/routes/app/+page.server.ts` chiama `startMotion` (la stessa di `/app/motion`), nomina il
  nodo con `briefName` (host dell'URL o prime parole) e reindirizza all'editor con `?brief=`.
- **Editor**: legge `brief`, lo toglie dall'URL (`replaceState`: un reload non lo rimanda) e lo
  passa a `ChatPanel` come prefill `PrefillMode.Send`; il messaggio parte quando la cronologia ha
  finito di caricare, così non viene sovrascritto.
- **Template**: brief pronti (`BRIEF_TEMPLATES` in `src/lib/motion/video-brief.ts`), stessa action.
  Scartato: precaricare un doc di `ad-templates.ts`, chiede asset che un utente nuovo non ha.
- **Gallery**: le prime 8 card pubblicate sotto il campo.
- **Onboarding**: `ARRIVAL_LANDING[FirstRun]` passa da canvas a dashboard; senza video la home
  mostra "Paste your URL. Get a video.".
- **Sidebar**: `Tool.role` (`Lead`/`Support`) decide la sezione; motion sale in Main fra Home e
  Gallery, i progetti scendono sotto i tool come "Assets & canvas". Griglia progetti e form
  "New project" escono dalla home; "+ New project" sta in fondo alla sezione progetti della
  sidebar (`AppSidebar.svelte`, POST a `/app?/project`), sempre visibile anche senza progetti.
