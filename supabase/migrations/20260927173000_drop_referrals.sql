-- I REFERRAL NON ESISTONO PIÙ: via le loro due tabelle.
--
-- La funzionalità è stata rimossa dal prodotto (settings-nav.test.ts lo dichiara: nessuna sezione
-- "referrals"), non c'è più un lettore né uno scrittore, e le tabelle sono già assenti in
-- produzione. Un drop, non un comment: stessa regola di 20260921191000_drop_leads.sql.
--
-- I deploy NON eseguono le migration: applicare a mano.

drop table if exists public.referrals;

drop table if exists public.referral_codes;
