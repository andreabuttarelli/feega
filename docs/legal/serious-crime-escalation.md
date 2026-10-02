# Serious-crime escalation (DSA art. 18)

Applies to reports flagged for escalation: every child sexual abuse material (CSAM) report, and every illegal-content report categorised as a threat to life or safety. The flag is the `escalates` column of the reason table (`src/lib/reports/reasons.ts`).

## What the system does

1. The report is saved with `escalated_at` set and priority 0 (CSAM) or 1.
2. Every address in `INTERNAL_EMAILS` receives an "URGENT" email with the case and a link to `/admin/reports`.
3. The case is shown first in the queue, outlined in red.

## What the person on call does

1. **Within one hour**, open the case. Do not download or forward CSAM; view it only as far as needed to confirm.
2. **Preserve evidence.** Decide "Remove content" (or "Remove and suspend account"). The node is soft-deleted, not erased, and the share link is revoked: the material stays in storage for the authorities. Do not delete the asset or the account data.
3. **Notify the authorities** when the information gives rise to a suspicion that a criminal offence involving a threat to life or safety has taken place, is taking place or is likely to take place:
   - CSAM, Italy: Polizia Postale — Centro Nazionale per il Contrasto alla Pedopornografia Online (CNCPO), [commissariatodips.it](https://www.commissariatodips.it). Content hosted for US users: NCMEC CyberTipline, [report.cybertip.org](https://report.cybertip.org).
   - Threat to life, Italy: 112; otherwise the police of the member state where the suspect or victim appears to be, or Europol if unclear.
   Give: case id, URL, time seen, account id and email of the uploader, IPs if available. Do not tell the uploader that a referral was made.
4. **Suspend** the account for CSAM (one CSAM strike terminates it automatically).
5. **Record** in the decision note the authority contacted, date and reference number.

## After

- Keep the case and evidence until the authority confirms it no longer needs them.
- Statements of reasons to the uploader may be delayed or limited where informing them would hinder an investigation (DSA art. 17(1) read with art. 18).
