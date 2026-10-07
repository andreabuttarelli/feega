# Componenti Custom: scope proprio, `format`, video su indirizzi privati

Tre buchi visti nel trailer Tappory.

- **Scope.** `definitionScript` destruttura `ctx` (`brand`, `rand`, …) e riceve come parametri i
  globali oscurati (`top`, `window`, …) nello stesso scope del corpo: un `const top` o un
  `let brand` del componente era un SyntaxError e il componente non caricava. Il corpo ora sta in
  un blocco proprio, quindi le sue dichiarazioni oscurano quei nomi invece di collidere.
- **Numeri.** `toLocaleString` e `Intl` dipendono dalla locale della macchina: preview e render
  potevano scrivere `1.234` e `1,234`. Il lint li rifiuta e indica `format.number`,
  `format.compact`, `format.percent` (`custom/format.ts`), deterministici e passati nel `ctx`.
- **Video privati.** Il producer scarica i video solo da host pubblici (blocca localhost e LAN):
  il render falliva più avanti senza dire perché. `farmProblem` ora rifiuta subito, nominando
  l'URL e la soluzione (importarlo come asset). Scartato l'import automatico: il server non può
  leggere un localhost del client.
