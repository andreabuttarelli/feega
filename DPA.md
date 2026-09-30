# Data Processing Agreement

> **Draft — to be reviewed by a lawyer before publication.**
> Last updated: 30 September 2026

This Data Processing Agreement ("DPA") forms part of the [Terms of Service](./TERMS.md) between **[LEGAL ENTITY]**, Italy, VAT no. **[VAT]**, **[ADDRESS]** ("feega", the "Processor") and the business customer that uses feega (the "Customer", the "Controller"). It applies under Article 28 of Regulation (EU) 2016/679 ("GDPR") whenever feega processes personal data on the Customer's behalf.

## 1. Acceptance and precedence

- The DPA is accepted together with the Terms when a business account or workspace is created or used on behalf of an organisation. [SIGNED COPY — available on request].
- It covers personal data the Customer puts into the Service or instructs feega to collect. feega's own processing as controller (account, billing, security, analytics) is governed by the [Privacy Policy](./PRIVACY.md).
- In case of conflict on data protection, this DPA prevails over the Terms.

## 2. Subject, duration, nature and purpose

| | |
|---|---|
| **Subject** | processing of Customer Personal Data needed to provide the Service described in Terms §2 |
| **Duration** | the term of the Customer's use of the Service, plus the deletion period in §11 |
| **Nature** | storage, organisation, retrieval, transmission to AI, publishing and ads providers, generation of derived content, display, sharing through links the Customer creates, deletion |
| **Purpose** | generating and editing content on the canvas, analysing brands, importing products and public social posts, scheduling and publishing posts, running Meta ad campaigns, and the related API, CLI and MCP access |

## 3. Data subjects and categories of data

| Data subjects | Categories of personal data |
|---|---|
| Customer's workspace members and invitees | name, email, role, avatar, API key metadata, actions performed (including by agents acting for them) |
| Customer's end customers, models, influencers, employees and other people appearing in content | names, images, likeness, voice, text about them contained in prompts, uploads, generated outputs and documents |
| People behind connected social accounts and ad accounts | handle, profile data, published posts, metrics, ad account identifiers, campaigns and creatives |
| Owners of public profiles the Customer adds to a feed | public profile data and public posts |
| People named in brand material (website, products, contacts) | names and contact data contained in the brand's website, store catalogue and uploaded documents |

The Customer must not submit special categories of data (Art. 9 GDPR) or data about criminal convictions (Art. 10) unless strictly necessary and lawful.

## 4. Customer instructions

- feega processes Customer Personal Data only on the Customer's documented instructions: the Terms, this DPA, and the Customer's use and configuration of the Service, including actions taken by agents through the Customer's API keys or MCP connection.
- feega informs the Customer if it believes an instruction infringes data protection law.
- feega may process data otherwise only where required by EU or Member State law, and informs the Customer first unless the law forbids it.
- feega does not use Customer Personal Data to train AI models and does not sell it.

## 5. Confidentiality

Everyone at feega authorised to process Customer Personal Data is bound by confidentiality. Access to production data is limited to those who need it to operate, secure or support the Service.

## 6. Security

feega implements the technical and organisational measures in **Annex 1**. The Customer is responsible for the security of its own credentials, API keys and share links, and for choosing whom it invites to a workspace.

## 7. Sub-processors

- The Customer gives a general authorisation for feega to engage the sub-processors listed in [SUBPROCESSORS.md](./SUBPROCESSORS.md).
- feega gives at least [30] days' notice before adding or replacing a sub-processor, by email to the workspace owner or in the Service.
- The Customer may object in writing on reasonable data-protection grounds within that period. The parties will discuss in good faith; if no solution is found, the Customer may terminate the affected part of the Service and receive a pro-rata refund of prepaid, unused fees [to confirm].
- feega imposes on each sub-processor data protection obligations equivalent to this DPA and remains liable to the Customer for their performance.
- AI model providers are reached through OpenRouter, whose catalogue changes over time; the provider that served a request is recorded in the usage log and shown in the Service.

## 8. International transfers

Where Customer Personal Data is transferred outside the EEA, feega relies on an adequacy decision (including the EU–US Data Privacy Framework for certified providers) or on the Standard Contractual Clauses (Commission Decision 2021/914, module 3 processor-to-processor) with supplementary measures where needed. A copy is available on request.

## 9. Assistance

- **Data-subject requests.** Most requests can be handled by the Customer directly in the Service (editing or deleting nodes, assets, brands, posts; disconnecting social accounts; revoking share links). feega forwards to the Customer any request it receives about Customer Personal Data and assists with the rest within [10] business days.
- **DPIAs and prior consultation.** feega provides reasonable information about the Service, its sub-processors and its security measures for the Customer's data protection impact assessments.
- **Authorities.** feega cooperates with supervisory authorities as required by law.

## 10. Personal data breaches

feega notifies the Customer **without undue delay**, with a target of **48 hours**, after becoming aware of a personal data breach affecting Customer Personal Data. The notice includes, as far as known: nature of the breach, categories and approximate number of data subjects and records, likely consequences, measures taken or proposed, and a contact point. Information not yet available is provided in phases. Notification is sent to the workspace owner's email [and SECURITY CONTACT, if provided].

## 11. Deletion and return

- The Customer can export its content from the Service and through the API and CLI while its account is active.
- At termination, feega deletes Customer Personal Data within [30] days, and from backups within [X] days, unless EU or Member State law requires retention (for example invoices, kept 10 years under Italian tax law).
- Soft-deleted canvas nodes are purged after [PURGE PERIOD].
- On request, feega confirms deletion in writing.

## 12. Audits

feega makes available the information needed to demonstrate compliance with Art. 28 GDPR: this DPA, the sub-processor list, Annex 1 and, where available, sub-processors' certifications and reports. If that is not sufficient, the Customer may carry out an audit, at its own cost, at most once a year, with [30] days' notice, during business hours, by an auditor bound by confidentiality, without access to other customers' data. Audits requested by a supervisory authority are not limited in frequency.

## 13. Liability

Each party's liability under this DPA is subject to the limitations in Terms §17, except where those limitations cannot apply under GDPR Art. 82 or other mandatory law.

## 14. Term, governing law and jurisdiction

This DPA lasts as long as feega processes Customer Personal Data. It is governed by **Italian law**, and the courts of [CITY] have exclusive jurisdiction, as in Terms §19.

---

## Annex 1 — Technical and organisational measures

| Area | Measure |
|---|---|
| Tenant isolation | every table carries the workspace (`org_id`); row-level security is enabled on all tables and each query runs with the signed-in user's rights, so a user reads only the workspaces they belong to |
| Privileged access | the database service key, which bypasses row-level security, is used only in declared code paths listed in a single registry that every use must reference |
| Authentication | Supabase Auth sessions in secure cookies; API keys for CLI and MCP are shown once and stored hashed; OAuth for MCP clients |
| Encryption in transit | HTTPS/TLS for the web app, API and every provider call |
| Encryption at rest | database and file storage encrypted at rest by the infrastructure providers [confirm with Supabase plan] |
| Storage | private buckets for uploaded and generated media, served through time-limited signed links; one public bucket only for avatars, logos and colour swatches |
| Access control | roles inside each workspace; invites by link or email; share links read-only and revocable |
| Concurrency and integrity | optimistic versioning on canvas nodes, so a conflicting write is refused rather than silently overwriting |
| Logging | each AI action is logged with action, model, provider, credits, time and acting user or agent; every moderation decision is logged; canvas events record who changed what |
| Moderation | every generation prompt is screened before reaching a model and refused when the screening cannot run (see [AI Transparency](./AI-TRANSPARENCY.md)) |
| Monitoring | error monitoring with Sentry; internal staff sessions excluded |
| Backups | [BACKUP POLICY — Supabase plan, frequency, retention] |
| Secrets | provider keys held as server-side environment variables, never shipped to the browser; secrets redacted from logs |
| Development | changes reviewed through pull requests with automated tests in CI; production data not used in tests |
| People | confidentiality obligations; least-privilege access to production [to confirm organisational measures] |
