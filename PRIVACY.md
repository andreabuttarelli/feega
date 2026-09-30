# Privacy Policy

> **Draft — to be reviewed by a lawyer before publication.**
> Last updated: 30 September 2026

This policy explains how feega processes personal data when you use feega.app, its API, CLI and MCP server (the "Service"), under Regulation (EU) 2016/679 ("GDPR") and Italian Legislative Decree 196/2003.

## 1. Controller

**[LEGAL ENTITY]**, Italy, VAT no. **[VAT]**, **[ADDRESS]**.
Privacy contact: [privacy@feega.app](mailto:privacy@feega.app). Data Protection Officer: [DPO — appointed / not required].

When you upload data about other people (for example customers, models or influencers in your brand material), you are the controller of that data and we process it as your processor. [DPA — available on request / link].

## 2. Data we process

| Category | What | Source |
|---|---|---|
| Account | name, email, password hash or login provider, avatar, language | you |
| Workspace | workspaces, roles, invites (invitee email), API keys (stored hashed) | you, your workspace members |
| Content | prompts, chat messages, canvas nodes, uploaded and generated text, images, video, audio, documents | you, agents acting for you |
| Brand | brand name, website analysis, voice, palette, logo, products imported from your store | you, public web pages and store endpoints |
| Social | connected account handle and profile, access tokens (held by our publishing provider), scheduled and published posts, public posts of profiles you add to a feed | you, the platforms, public sources |
| Ads | Meta ad account identifiers, campaigns, creatives, performance metrics | Meta, on your authorisation |
| Billing | plan, credit balance and ledger, Stripe customer and invoice IDs, billing address/VAT if given | you, Stripe (we never see full card numbers) |
| Usage logs | log of each AI action: action, model, provider, credits, time, acting user or agent | the Service |
| Moderation | for each screened prompt: verdict, category, scores, reason, acting user | the Service |
| Age verification (NSFW, not yet available) | only the result: verified yes/no, provider, method, date — **no identity documents** | certified verification provider |
| Technical | IP address, browser, device, pages, errors | your device |

We do not ask for special categories of data (Art. 9 GDPR). Do not include them in prompts unless necessary.

## 3. Purposes and legal bases

| Purpose | Legal basis |
|---|---|
| Provide the Service: accounts, workspaces, canvas, generation, publishing, ads, sharing, API/CLI/MCP | Contract — Art. 6(1)(b) |
| Billing, credits, invoicing, tax records | Contract; legal obligation — Art. 6(1)(b), (c) |
| Content moderation, abuse and fraud prevention, security | Legitimate interest — Art. 6(1)(f); legal obligation where applicable |
| Age verification for NSFW mode | Legal obligation / legitimate interest — Art. 6(1)(c)/(f) [to confirm] |
| Handling DSA notices and authority requests | Legal obligation — Art. 6(1)(c) |
| Error monitoring and debugging | Legitimate interest — Art. 6(1)(f) |
| Cookieless aggregate page statistics (Vercel Web Analytics) | Legitimate interest — Art. 6(1)(f) |
| Full analytics, session replay, advertising measurement | Consent — Art. 6(1)(a) |
| Service emails (invites, notifications) | Contract / legitimate interest |

We do not sell personal data and do not use your content to train AI models. We make no decisions with legal or similarly significant effects based solely on automated processing (Art. 22). Moderation refusals are automated but concern a request, not you; you can contact us to have one reviewed.

## 4. Recipients (processors)

| Provider | Purpose | Location |
|---|---|---|
| Supabase | database, authentication, file storage, realtime | [REGION — EU/US] |
| Vercel | hosting, serverless functions, web analytics | US / global |
| Stripe | payments and subscriptions | EU / US |
| OpenRouter, and the model providers it routes to | text, image, video generation | US / other |
| Google (Gemini API) | text and image generation | US / global |
| Wiro | image and video generation | [LOCATION] |
| ElevenLabs | voice, music and sound generation | US / EU |
| TypeSafe (Jev classifier) and an LLM reviewer via OpenRouter | prompt moderation | [LOCATION] |
| Zernio | connecting social accounts, publishing, reading account metrics | [LOCATION] |
| Meta Platforms | ad campaigns on your ad account | IE / US |
| ScrapeCreators | reading public social profiles and posts | US |
| Resend | transactional email | US |
| Sentry | error monitoring (may include user ID, email, IP) | US / EU |
| PostHog | product analytics (consent only) | [US / EU] |
| Microsoft Clarity | session replay (consent only) | US |
| Seline | web analytics | [LOCATION] |
| Google (gtag.js conversion tracking), Meta Pixel | advertising conversion measurement | US |
| Framer | marketing website feega.app | NL / global |
| [AGE VERIFICATION PROVIDER] | age verification (NSFW, not yet available) | [LOCATION] |

When you publish, the content goes to the platform you chose (Instagram, Facebook, TikTok, etc.), which becomes an independent controller. When you share a link, anyone holding it can see the shared content. We may disclose data to authorities where required by law.

## 5. International transfers

Some providers are outside the EEA, mainly in the United States. Transfers rely on the EU–US Data Privacy Framework where the provider is certified, or on the European Commission's Standard Contractual Clauses with supplementary measures. Ask us for a copy.

## 6. Retention

| Data | Kept |
|---|---|
| Account, workspace, content | while the account/workspace exists; deleted within [30] days of closure, backups within [X] days |
| Deleted canvas nodes | soft-deleted, then [PURGE PERIOD] |
| Social access tokens | until you disconnect the account |
| Usage logs (AI calls) | [PERIOD] |
| Moderation logs | [PERIOD] |
| Age-verification result | while the account exists |
| Invoices and billing records | 10 years (Italian tax law) |
| Error logs (Sentry) | per provider retention, [90] days |
| Analytics | [PERIOD] |

## 7. Cookies and similar technologies

- **Strictly necessary**: authentication session and preferences. No consent needed.
- **Cookieless page statistics**: Vercel Web Analytics.
- **Analytics, consent only**: PostHog (cookies, session recording with masked text and inputs), Microsoft Clarity, Seline, Sentry session replay (fully masked).
- **Marketing, consent only**: Meta Pixel and the Google gtag.js conversion tag (Google Consent Mode v2, default denied).

You can change your choice at any time via "Cookie settings" in Settings → Profile. Details: [Cookie Policy](./COOKIES.md).

## 8. Your rights

You can request access, rectification, erasure, restriction, portability, and object to processing based on legitimate interest; you can withdraw consent at any time. Write to [privacy@feega.app](mailto:privacy@feega.app). We answer within one month. You can complain to the *Garante per la protezione dei dati personali* (garanteprivacy.it) or your local authority.

## 9. Minors

The Service is for people aged **18 or over**. We do not knowingly collect data of minors; if we learn of it, we delete the account. NSFW mode is strictly 18+ and requires verified age.

## 10. Security

Encryption in transit, row-level access control per workspace, private storage buckets with signed links, hashed API keys, restricted use of privileged credentials, and provider security certifications. No system is perfectly secure; we will notify you and the authority of breaches as required by Art. 33–34 GDPR.

## 11. Changes

We will update the date above and, for material changes, notify you by email or in the Service.

---

Questions: [privacy@feega.app](mailto:privacy@feega.app)
