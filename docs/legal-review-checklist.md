# Legal review checklist — TERMS.md, PRIVACY.md

## Placeholders

- `[LEGAL ENTITY]`, `[VAT]`, `[ADDRESS]` — the archived drafts named Marco Di Franco (ditta individuale, P.IVA IT18500501004); confirm who operates feega now.
- `[SUPPORT EMAIL]`, `[LEGAL NOTICE EMAIL]` (DSA single point of contact).
- `[DPO]`, `[DPA]` link.
- `[VAT INCLUDED / EXCLUDED]` on plan prices.
- `[REFUND POLICY]`; top-up fate on termination `[REFUNDED / FORFEITED]`.
- Price-change and terms-change notice `[30]` days; liability cap `[12]` months; court `[CITY]`.
- Account deletion flow `[HOW]` — no self-serve deletion found in the code.
- Retention periods: account closure, backups, soft-deleted nodes purge, AI call logs, moderation logs, Sentry, analytics.
- Provider locations: Supabase region, Wiro, TypeSafe/Jev, Zernio, PostHog host, Seline.
- `[AGE VERIFICATION PROVIDER]` — not chosen; the code has no certified verifier yet.

## Points to confirm

1. **Age verification**: whether Italian/EU rules require it for NSFW generation, which certified provider, legal basis for storing the result.
2. **Stripe and adult content**: Stripe restricts adult services; confirm NSFW mode may be sold through Stripe.
3. **Refunds and consumer withdrawal**: waiver wording for credits used within 14 days (Codice del Consumo art. 59).
4. **Liability caps and warranties**: enforceability for consumers vs businesses; conformity guarantee for digital services.
5. **AI Act**: art. 50 labelling duties (provider vs deployer), art. 4 literacy, art. 5 list; machine-readable marking is claimed only "where technically feasible".
6. **DSA**: notice-and-action, statement of reasons, points of contact; hosting-service status given share links.
7. **Credit expiry**: subscription credits expire at period end, welcome credits after 14 days, top-ups never — check against consumer law.
8. **Monthly credit fee per connected social account** — disclosure adequacy.
9. **Consent**: `src/app.html` loads the Google gtag.js conversion tag after interaction or 10 s **without consent gating**; verify Meta Pixel and Seline gating in `src/lib/analytics.ts`. Likely non-compliant until fixed.
10. **Sentry `sendDefaultPii: true`** — justify under legitimate interest or turn off.
11. **Scraping** of public profiles (ScrapeCreators) and websites — legal basis and platform terms.
12. Minimum age 18 for the whole Service.
13. `COOKIES.md` is still the archived August version — update to match.
14. Third-party model provider terms passed through to users (Terms §7).
