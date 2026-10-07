# Riserva dei render: restituita alla scadenza, con la sua scadenza

**Perché.** Due buchi di #163. Un render chiuso da `expireStuckRuns` (6 h) teneva la riserva per
sempre. E il rimborso tornava come credito senza scadenza: una riserva presa dai crediti di
benvenuto (14 giorni) li rendeva permanenti.

**Cosa.**
- `expireStuckRuns` ha una tabella `ON_EXPIRE` accanto a `JOB_TIMEOUTS_MS`, una riga per genere:
  `motion_render` → `releaseHold`.
- `holdCredits` calcola da quali grant esce la riserva (`portionsOf`): i debiti consumano prima i
  grant che scadono prima, gli scaduti non contano, come `org_credit_balance`. Restituisce le
  porzioni `{ amount, expiresAt }`, salvate in `params.billing.portions`.
- `releaseCredits` scrive un grant `refund` per porzione, con la stessa `expires_at`. Una
  porzione già scaduta torna già scaduta: i crediti spariscono come sarebbero spariti.
- Batch: un solo hold, diviso per riga in ordine (`splitPortions`).
- Run senza `portions` (avviati prima di questa modifica): rimborso senza scadenza, come prima.

**Scartato.** Copiare la `source` del grant originale (`promo`, `subscription_renewal`): un
rimborso registrato come `subscription_renewal` farebbe passare un'org gratuita per pagante
(`FREE_ORGS_PER_USER`). Il tipo di credito che conta qui è la scadenza; la source resta `refund`.
