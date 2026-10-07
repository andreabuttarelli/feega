# Le preview Vercel sono opt-in

Ogni push di ogni branch costruiva una preview su `feega-5ksn` (MCP): 332 build in 11 giorni, ~4 CPU-min l'una sulla macchina `standard`, la voce più cara di Build CPU. Su `feega` le preview erano già saltate da un ignore command scritto nella dashboard, invisibile al repo.

`scripts/vercel-ignore.sh` è ora l'`ignoreCommand` di entrambi i progetti: builda la produzione e le preview il cui ultimo commit contiene `[preview]`; con un percorso come argomento (`..` per l'MCP) salta anche la produzione che non lo tocca. Exit 0 salta, exit 1 builda.

Scartato: `git.deploymentEnabled: false`, che toglie anche l'opt-in. Scartato: saltare la produzione per commit di soli test/doc — 6 merge su 188 negli ultimi 15 giorni.
