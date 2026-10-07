# Sub-processors

> **Draft — to be reviewed by a lawyer before publication.**
> Last updated: 30 September 2026

feega (**[LEGAL ENTITY]**, VAT no. **[VAT]**, **[ADDRESS]**) uses the providers below to run the Service. When we process personal data on behalf of a business customer, these are our sub-processors under the [Data Processing Agreement](./DPA.md). The same providers are listed in the [Privacy Policy](./PRIVACY.md).

"SCCs" means the European Commission's Standard Contractual Clauses (Decision 2021/914). "DPF" means the EU–US Data Privacy Framework, relied on only where the provider is certified.

## Infrastructure and payments

| Provider | Purpose | Personal data | Location | Transfer mechanism |
|---|---|---|---|---|
| Supabase | database, authentication, file storage, realtime | all account, workspace, content, brand, social, ads and billing records; uploaded and generated files | [REGION — EU/US] | [DPF / SCCs — if outside the EEA] |
| Vercel | hosting, serverless functions, web analytics | request data, IP address, content processed during a request | US / global | DPF / SCCs |
| Stripe | payments, subscriptions, invoices | name, email, billing address, VAT number, payment details (held by Stripe) | EU / US | DPF / SCCs |
| Resend | transactional email (invites, notifications) | email address, name, message content | US | DPF / SCCs |

## AI generation and moderation

| Provider | Purpose | Personal data | Location | Transfer mechanism |
|---|---|---|---|---|
| OpenRouter, and the model providers it routes each request to | text, chat, image and video generation; the second-stage moderation review | prompts, attachments, brand context, generated outputs | US / other, per model | SCCs [to confirm per provider] |
| Wiro | image and video generation for age-restricted features; 3D models from an image (every project) | prompts, reference media, generated outputs | [LOCATION] | [SCCs — to confirm] |
| ElevenLabs | voice-over, music and sound generation | script text, chosen voice, generated audio | US / EU | DPF / SCCs |
| TypeSafe (Jev classifier) | first-stage prompt moderation | prompt text, reference descriptions | [LOCATION] | [SCCs — to confirm] |

## Age verification

| Provider | Purpose | Personal data | Location | Transfer mechanism |
|---|---|---|---|---|
| Didit (Didit Identity Spain, S.L., Barcelona) | one-time 18+ check for age-restricted features: age estimation from a selfie, ID document only when the estimate is not conclusive | selfie and liveness capture; ID document only on fallback; our user ID as session reference | EU — AWS Ireland (eu-west-1) | none needed (EEA); Didit's DPA is Annex 2 of its Business Terms |

Didit sends us only the outcome (over 18 or not) and a session ID. Once the outcome is final we ask Didit to erase the session, without keeping face templates.

Google Gemini models are reached through OpenRouter; the current code does not call the Google Gemini API directly.

### What stays at AI providers after a generation

- **Input files** are sent as signed links that expire after 5 minutes.
- **Wiro**: once the output is stored in our storage, or the task has failed or been cancelled, we ask Wiro to delete the task's input and output files. Failed requests are retried every minute for up to 7 days. Wiro keeps the task record and its parameters, including the prompt.
- **ElevenLabs**: a dubbing project is deleted once the dubbed file is stored, or once the dubbing has failed. When ElevenLabs reports a history item for a generation (text-to-speech, voice changer), that item is deleted after our copy is stored. Same retry window. ElevenLabs zero-retention mode is not used (enterprise plans only); other outputs and ElevenLabs' own logs follow its retention policy.
- **OpenRouter**: text, chat, embedding and Gemini image requests are routed only to upstream providers that do not collect or train on request data. Image requests through OpenRouter's images endpoint and video requests are not restricted. Zero data retention is not enforced; each provider's own retention applies.

## Social, ads and research

| Provider | Purpose | Personal data | Location | Transfer mechanism |
|---|---|---|---|---|
| Zernio | connecting social accounts, publishing, reading account metrics, Meta ads operations | account handle and profile, access tokens, posts, metrics | [LOCATION] | [SCCs — to confirm] |
| Meta Platforms | ad campaigns on your ad account | ad account IDs, campaigns, creatives, metrics | IE / US | DPF / SCCs |
| ScrapeCreators | reading public social profiles and posts you add to a feed | public profile data and posts | US | SCCs [to confirm] |

## Monitoring and analytics

| Provider | Purpose | Personal data | Location | Transfer mechanism |
|---|---|---|---|---|
| Sentry | error monitoring; session replay only when an error occurs | user ID, email, IP address, browser data, error context | US / EU | DPF / SCCs |
| PostHog | product analytics (anonymous without consent; persistent and session recording with consent) | pseudonymous ID, user ID and email once signed in, pages, clicks | EU (PostHog EU cloud) | none needed [to confirm hosting] |
| Microsoft Clarity | session replay and heatmaps (consent only) | pseudonymous ID, interactions, device data | US | DPF / SCCs |
| Seline | page-view analytics; linked to your user ID once signed in | pages, referrer, user ID | [LOCATION] | [to confirm] |
| Google (gtag.js conversion tag) | advertising conversion measurement | cookie IDs, pages, conversion events, IP address | US | DPF / SCCs |
| Meta Pixel | advertising conversion measurement | cookie IDs (`_fbp`, `_fbc`), pages, conversion events, IP address | IE / US | DPF / SCCs |
| Framer | marketing website | visitor data on the marketing site | NL / global | [DPF / SCCs — to confirm] |

## Not yet active

| Provider | Purpose | Status |
|---|---|---|
| [AGE VERIFICATION PROVIDER] | age verification for age-restricted features; we keep only the result | not chosen; age-restricted features are not available |

Platforms you publish to (Instagram, Facebook, TikTok and others) receive your content as independent controllers, not as our sub-processors.

## Changes

We give business customers at least [30] days' notice before adding or replacing a sub-processor, by email to the workspace owner or in the Service, and update this page. You may object on reasonable data-protection grounds as described in the [DPA](./DPA.md) §7.

---

Questions: [privacy@feega.app](mailto:privacy@feega.app)
