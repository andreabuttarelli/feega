# Competitor social media research: 2026-10-25

Data source: ScrapeCreators API, pulled 2026-10-25. 233 API calls. 1,646 posts from 25 accounts on 6
platforms. Raw normalised data is in [`data/`](data/): `posts.csv` (one row per post), `accounts.json`
(one row per account and platform), `handles.json` (handles used).

ER (engagement rate) = (likes + comments + shares/reposts/quotes + bookmarks or saves) / followers × 100,
per post. Views are left out of the formula. "Lift" = a post's ER divided by its own account's median
ER, so big and small accounts can be compared.

## Executive summary

1. **Founders beat brands by roughly 10×.** On X, the founders' median account ER was 0.6–5.2%
   (Pietro Schirano 5.2, Jonny Burger 3.4, Cristóbal Valenzuela 2.9, Weber Wong 2.6, Meng To 2.5,
   Pieter Levels 2.2). The brand accounts sat at 0.03–0.2% (Figma 0.14, Framer 0.17, Spline 0.03,
   Runway 0.07). All 32 of the top 5% X posts came from founder accounts except one Jitter post
   from 2023.
2. **The single most viral format is the founder's "Introducing X" launch video, 15–100 s, with a
   one-line hook.** Weber Wong's "Introducing FLORA, Your Intelligent Canvas." (90 s): 8.7k
   engagements and 633k views on 11k followers. Jonny Burger's "Announcing Remotion" (98 s): 11.5k
   engagements on 16k followers. Hooks containing "Introducing" have a median lift of **1.9× on X,
   1.5× on Instagram and 1.9× on YouTube**. No other hook word comes close.
3. **A short, emotional or provocative hook does better than an explanation.** Founder viral hooks
   are 2–8 words: "YES!", "how fucking cool this is.", "should we open-source?", "who wants early
   access? 👀", "two sides of the same coin". Victor Perez's (Krea) "YES!" reached **242% ER**
   (20.5k engagements on 8.5k followers).
4. **Median ER benchmarks for accounts active in the last 90 days with at least 1k followers:**
   X 0.19% (p75 1.4%, driven by founders), Instagram 0.18%, TikTok 0.32% (only 3 active accounts),
   LinkedIn 0.05%, Threads 0.04%, YouTube 0.02%. On every platform except X, a brand account that
   reaches 0.3% is in the top quartile.
5. **Instagram: carousels slightly beat Reels** (1.12× vs 0.98× lift). "Introducing…" and "New…"
   captions also do well (1.5× and 1.2×). "Comment X to get…" bait **underperforms (0.63×)**.
   Video length (≤15 s up to >60 s) makes no difference. The opening seconds matter, not the
   running time.
6. **Video wins on X** (1.1× vs 0.91× for images). Within video, 30–60 s and >60 s clips beat
   15–30 s clips (1.12–1.21× vs 0.78×). Threads and replies underperform (0.7–0.86×), so put the
   payload in the first post.
7. **LinkedIn: native video ≈ 1.0×, image 0.87×, plain text or link 0.42×.** Weavy (now Figma
   Weave) and Figma post about 8 times a week there and get the most absolute engagement among the
   challengers. Remotion's tutorial post gets the best ER (1.6%). Fridays do best (1.5× lift,
   small n).
8. **Brand cadence on the main channel is 2–5 posts a week.** Canva posts about 4/wk on Instagram,
   TikTok and YouTube. Figma posts 2.8/wk on Instagram, 3.6/wk on YouTube and 5.2/wk on Threads.
   Framer and Spline post about 1.5/wk on Instagram. Jitter posts 1.7/wk on Instagram and
   LinkedIn, using a fixed weekly "New this week:" slot. Founders post daily, and the API only
   returns their top posts (see limits).
9. **The challengers (Flora, Krea, Weavy, Lovart, Recraft, Pika) barely use Instagram or TikTok.**
   Some of the expected handles belong to unrelated accounts, or the accounts are deactivated.
   Their growth runs through X (founder plus brand) and LinkedIn. TikTok is effectively empty in
   this category: Figma has 63k followers there, Framer 8.8k, Jitter 1.4k, and most others have
   none. This is open ground.
10. **Weekly launch rhythms and partner hooks drive spikes.** Jitter ties its posts to Claude
    models ("Jitter AI just got an upgrade with Claude Opus 5.5!", its best LinkedIn post at 0.64%).
    Lovart and Remotion tie theirs to OpenAI or Codex plugins. Spline's "Spline for ChatGPT" Short
    reached 2.2% ER and 305k views. Riding a big AI platform's news is the cheapest reach available
    to an MCP-first product like feega.

## Per-competitor tables

Followers are as of 2026-10-25. Posts/wk is calculated over the window of fetched posts. "Med ER"
is the median per-post ER. Founders' X windows span years because the API returns their top posts
(see limits).

### Direct competitors

| Account | Platform | Followers | Posts fetched | Window | Posts/wk | Med eng | Med ER % | Med views | Main formats |
|---|---|---:|---:|---|---:|---:|---:|---:|---|
| Figma | Instagram | 973,428 | 48 | 06-26 → 10-23 | 2.8 | 2,998 | 0.308 | 111,423 | reel 28 / carousel 17 |
| Figma | TikTok | 63,201 | 38 | 06-18 → 10-22 | 2.1 | 204 | 0.323 | 4,016 | video |
| Figma | YouTube | 794,000 | 30 | 08-24 → 10-22 | 3.6 | 186 | 0.023 | 19,673 | video 25 / short 5 |
| Figma | Threads | 315,592 | 15 | 10-02 → 10-23 | 5.2 | 186 | 0.059 | – | video |
| Figma | LinkedIn | 2,131,115 | 10 | 10-13 → 10-23 | 7.8 | 481 | 0.023 | – | video/text |
| Figma | X | 579,175 | 6* | – | – | 821 | 0.142 | 1,819,641 | video/photo |
| Canva | Instagram | 2,631,839 | 48 | 07-30 → 10-23 | 4.0 | 780 | 0.030 | 58,739 | reel 25 / carousel 18 |
| Canva | TikTok | 953,108 | 40 | 07-29 → 10-22 | 3.3 | 72 | 0.008 | 4,145 | video |
| Canva | YouTube | 918,000 | 30 | 08-17 → 10-21 | 3.2 | 26 | 0.003 | 3,336 | video |
| Canva | LinkedIn | 2,874,329 | 9 | 10-05 → 10-23 | 3.7 | 100 | 0.004 | – | image/video |
| Canva | X | 340,554 | 3* | – | – | 110 | 0.032 | 11,714 | video |
| Framer | Instagram | 303,905 | 48 | 02-23 → 10-22 | 1.4 | 841 | 0.277 | 32,965 | reel 33 / carousel 14 |
| Framer | YouTube | 360,000 | 30 | 09-09 → 10-23 | 4.9 | 41 | 0.011 | 3,163 | video 22 / short 8 |
| Framer | LinkedIn | 138,248 | 10 | 10-15 → 10-24 | 7.8 | 35 | 0.025 | – | video |
| Framer | Threads | 59,069 | 15 | 09-28 → 10-24 | 4.0 | 24 | 0.041 | – | video |
| Framer | TikTok | 8,839 | 39 | dormant since 2026-05 | 0.2 | 114 | 1.29 | 3,988 | video |
| Framer | X | 203,146 | 3* | – | – | 336 | 0.165 | 24,672 | text/video |
| Runway | Instagram | 644,851 | 48 | 04-13 → 10-23 | 1.7 | 531 | 0.082 | 54,640 | reel |
| Runway | YouTube | 139,000 | 30 | 08-12 → 10-21 | 3.0 | 98 | 0.071 | 6,373 | video |
| Runway | LinkedIn | 197,119 | 10 | 10-07 → 10-23 | 4.4 | 103 | 0.052 | – | video |
| Runway | Threads | 40,043 | 15 | 09-21 → 10-21 | 3.6 | 11 | 0.028 | – | video |
| Runway | X | 294,619 | 3* | – | – | 214 | 0.073 | 67,692 | video |
| Spline | Instagram | 297,295 | 48 | 03-24 → 10-23 | 1.6 | 136 | 0.046 | 10,600 | reel 33 / carousel 15 |
| Spline | YouTube | 141,000 | 30 | 2025-09 → 10-21 | 0.5 | 129 | 0.091 | 5,761 | video/short |
| Spline | LinkedIn | 134,778 | 9 | 10-08 → 10-22 | 4.8 | 18 | 0.013 | – | video |
| Spline | X | 112,625 | 12* | – | – | 31 | 0.028 | 4,564 | text |
| Rive | Instagram | 56,789 | 48 | 2025-02 → 10-22 | 0.5 | 156 | 0.274 | 5,885 | reel |
| Rive | LinkedIn | 83,882 | 3 | 10-20 → 10-22 | – | 38 | 0.045 | – | video |
| Rive | TikTok | 2,214 | 40 | dormant since 2025-11 | 1.2 | 19 | 0.836 | 471 | video |
| Rive | X | 86,510 | 2* | – | – | 575 | 0.665 | 62,238 | video |
| Jitter | Instagram | 30,805 | 48 | 04-08 → 10-20 | 1.7 | 79 | 0.255 | 3,584 | reel 46 |
| Jitter | LinkedIn | 23,878 | 10 | 09-09 → 10-20 | 1.7 | 19 | 0.080 | – | video |
| Jitter | X | 24,782 | 50* | 2022 → 2026-07 | – | 302 | 1.217 | 24,949 | video 49 |
| Jitter | TikTok | 1,379 | 40 | dormant | 0.1 | 16 | 1.124 | 586 | video |
| Lovart | Instagram | 97,021 | 48 | 06-23 → 10-21 | 2.8 | 94 | 0.097 | 9,732 | reel 29 / carousel 16 |
| Lovart | X | 32,515 | 6* | – | – | 55 | 0.168 | 2,246 | video |
| Lovart | LinkedIn | 6,956 | 10 | 09-09 → 10-24 | 1.6 | 7 | 0.101 | – | video |
| Krea | X | 122,788 | 2* | – | – | 1,756 | 1.43 | 664,291 | video |
| Krea | LinkedIn | 76,566 | 5 | 10-16 → 10-23 | 5.0 | 16 | 0.021 | – | text/video |
| Flora | X (@floraai) | 28,437 | 2* | – | – | 19 | 0.067 | 1,453 | link |
| Weavy / Figma Weave | X | 7,783 | 50 | 2025-04 → 2025-11 | 1.7 | 11 | 0.141 | 933 | video 28 |
| Weavy / Figma Weave | LinkedIn | 49,652 | 10 | 10-14 → 10-23 | 7.8 | 72 | 0.145 | – | video/image |
| Recraft | X | 17,068 | 2* | – | – | 239 | 1.40 | 291,278 | video |
| Recraft | LinkedIn | 9,953 | 10 | 09-24 → 10-22 | 2.6 | 15 | 0.151 | – | image |
| Recraft | TikTok | 86 | 40 | 2026-07 burst | 28 | 8 | – | 461 | video |
| Pika | X | 150,641 | 1* | – | – | 1,276 | 0.847 | 534,263 | video |
| Freepik → Magnific | X (@magnific) | 92,009 | 2* | – | – | 64 | 0.069 | 3,595 | video |
| Kittl | LinkedIn | 10,307 | 9 | 09-15 → 10-15 | 2.1 | 22 | 0.213 | – | image |
| Remotion | X | 58,416 | 50* | 2021 → 2025-03 | – | 82 | 0.140 | 10,293 | video 28 |
| Remotion | YouTube | 7,600 | 30 | 2023 → 2026-03 | 0.2 | 66 | 0.862 | 3,076 | video |
| Remotion | LinkedIn | 2,565 | 2 | 02 → 04 | – | 34 | 1.33 | – | video/image |

\* X brand rows: after removing retweets and other authors, the X endpoint returned only a few of
the brand's own recent posts. Treat these as a sample, not a cadence.

Not found or empty: Freepik Instagram, TikTok and YouTube (rebranded to Magnific in April 2026),
Flora TikTok and LinkedIn, Spline TikTok (deactivated), Lovart TikTok (deactivated), Pika
Instagram, TikTok and LinkedIn, Kittl X and TikTok (empty or private), Rive and Jitter YouTube
(handle not resolved). The handles `florafauna.ai` (Instagram), `kittl` (Instagram), `krea.ai`
(Instagram and TikTok) belong to unrelated or squatted accounts and are **excluded**.

### Builders who post in public (X)

| Founder | Product | Followers | Med eng (top-tweets sample) | Med ER % | Med views | Formats |
|---|---|---:|---:|---:|---:|---|
| Pieter Levels | Photo AI | 982,059 | 21,212 | 2.16 | 2,539,480 | photo 30 / text 14 |
| Meng To | Aura | 189,549 | 4,728 | 2.49 | 477,206 | video 35 / photo 14 |
| Danny Postma | HeadshotPro | 188,387 | 2,888 | 1.53 | 445,037 | photo / text |
| Pietro Schirano | MagicPath | 119,303 | 6,181 | 5.18 | 650,125 | photo / video |
| Cristóbal Valenzuela | Runway | 51,531 | 1,501 | 2.91 | 128,655 | video 32 |
| Jonny Burger | Remotion | 16,290 | 559 | 3.43 | 57,532 | video 35 |
| Weber Wong | Flora | 11,291 | 298 | 2.64 | 27,066 | text 22 / photo 15 |
| Victor Perez | Krea | 8,496 | 55 | 0.64 | 9,938 | photo / video |
| Diego Rodríguez | Krea | 8,098 | 18 | 0.22 | 1,495 | text 35 |

Jitter's founders were not covered: their handles could not be verified within the call budget.

## What goes viral: the top 5% by ER

The full lists are in `data/posts.csv` (sort by `er_follower` within each platform). Times are UTC.

### X (32 posts; the 10 most instructive below)

| ER % | Account | Format | Hook (first line) | Length | Video | Day/time | CTA | Link |
|---:|---|---|---|---:|---:|---|---|---|
| 242 | Victor Perez (Krea) | video demo, reaction | "YES!" | 28 ch | 14 s | Thu 15h | none, link | [x](https://x.com/viccpoes/status/2014366591312695745) |
| 165 | Diego Rodríguez (Krea) | founder story/advice | "i once was talking to a guy who … sold it to google" | 236 | – | Sun 21h | none | [x](https://x.com/asciidiego/status/2106861188609089664) |
| 77 | Weber Wong (Flora) | launch video | "Introducing FLORA, Your Intelligent Canvas." | 116 | 90 s | Wed 17h | try link | [x](https://x.com/weberwongwong/status/1894794612398792974) |
| 74 | Weber Wong (Flora) | meme/image | "two sides of the same coin" | 50 | – | Wed 02h | none | [x](https://x.com/weberwongwong/status/1975749583079694398) |
| 71 | Jonny Burger (Remotion) | launch video | "🎥 Announcing Remotion - a framework for making videos in React!" | 285 | 98 s | Mon 17h | repo link | [x](https://x.com/JNYBGR/status/1358824089960542208) |
| 64 | Victor Perez (Krea) | video demo | "how fucking cool this is." | 49 | 29 s | Thu 14h | none | [x](https://x.com/viccpoes/status/1961079571849306296) |
| 27 | Cristóbal Valenzuela (Runway) | launch video | "There's a new way to make videos." | 114 | 28 s | Fri 00h | try link | [x](https://x.com/c_valenzuelab/status/1666972498334990336) |
| 24 | Weber Wong (Flora) | build-in-public metric | "We raised $6.5 million to build the world's most powerful creative tool." | 96 | 114 s | Wed 16h | link | [x](https://x.com/weberwongwong/status/1927756765799616868) |
| 21 | Victor Perez (Krea) | community poll | "should we open-source?" | 22 | – | Tue 14h | reply | [x](https://x.com/viccpoes/status/1934983545233277428) |
| 14 | Victor Perez (Krea) | waitlist tease | "who wants early access? 👀" | 25 | – | Tue 14h | reply | [x](https://x.com/viccpoes/status/1932441752188719273) |

Others in the top 5%: Meng To's 44-minute "how to prompt for UI" tutorial (18.6%) and his ThreeUI
open-source release (13.2%). Jonny Burger's "Video resizing using WebCodecs!" (17.6%) and
"Breakthrough! I built a MP4 ⇔ WebM converter" (10.8%). Weber Wong's "Nike just put out a role …
mastery of FLORA" (15.6%), a social-proof screenshot. Pietro Schirano's "$100k monthly revenue in 9
months" (12.2%), a build-in-public metric. Jitter's "Introducing the all-new Jitter! 💫" (10.6%,
20 s, Tue 09h).

### Instagram (19 posts)

| ER % | Account | Format | Hook | Video | Day/time | Link |
|---:|---|---|---|---:|---|---|
| 2,012 | Runway | short film made with the tool (**outlier: 138M views, almost certainly paid or boosted**) | "Big ideas don't need big budgets." | 35 s | Mon 14h | [ig](https://www.instagram.com/p/DXExjj0immR/) |
| 78 | Lovart | meme carousel (giveaway-like spike) | "👨‍🦲👨‍🦲👨‍🦲" | – | Wed 14h | [ig](https://www.instagram.com/p/DeMh5sdj-WS/) |
| 18 | Runway | made-with-tool short | "If you have a story, bring it to life." | 49 s | Fri 22h | [ig](https://www.instagram.com/p/DYGFhrAqMHB/) |
| 9.4 | Framer | product/merch launch | "Introducing the Framer F1 Keyboard." | 31 s | Tue 15h | [ig](https://www.instagram.com/p/DYzlUhLxp2O/) |
| 8.3 | Rive | feature demo + creator credit | "Add volume to your Rive characters with Vector Feathering" | 158 s | Mon 20h | [ig](https://www.instagram.com/p/DaLsGv3xSrN/) |
| 5.9 | Lovart | prompt-pack carousel | "💐STEAL OUR PROMPTS" | – | Tue 13h | [ig](https://www.instagram.com/p/DZ7hCsWGzVK/) |
| 5.0 | Lovart | meme reel | "Afraid of ghosts, but more afraid of typos" | 15 s | Fri 10h | [ig](https://www.instagram.com/p/DejRhrzJDBF/) |
| 3.8 | Figma | culture/brand reel (Config) | "Brat and It's Completely Config…" | 52 s | Fri 16h | [ig](https://www.instagram.com/p/DaDm7nEP76s/) |
| 3.7 | Runway | generated story | "Welcome to the box. A generated sticker story." | 91 s | Mon 16h | [ig](https://www.instagram.com/p/DeZshWtq0Ic/) |
| 2.1 | Jitter | before/after motion | "Your static designs deserve better than a simple fade in." | 56 s | Wed 14h | [ig](https://www.instagram.com/p/DW35Xx5D42o/) |
| 1.9 | Jitter | launch | "Introducing Jitter AI ✨" | 48 s | Wed 15h | [ig](https://www.instagram.com/p/DYSK39xP2wq/) |

### TikTok, YouTube, LinkedIn, Threads

- **TikTok**: Figma's culture/meme clips: "Turned 14 today (and no this isn't a phase 🙄)" (9.4 s,
  9.7%), "Finals.svg" (10 s, 9.6%) ([link](https://www.tiktok.com/@figma/video/7684656181096369422)).
  Framer and Jitter's "how to X in N seconds" tutorials from 2021–23
  ([Framer moving gradient, 14%](https://www.tiktok.com/@framer/video/7202575786153430278)).
- **YouTube**: Remotion's "Create motion graphics with AI – Simple tutorial for beginners" (323 s,
  22% ER, 101k views on 7.6k subscribers) ([link](https://www.youtube.com/watch?v=5NRAOnKc3c8)).
  Spline's "Introducing Spline for ChatGPT 🚀" Short (32 s, 305k views)
  ([link](https://www.youtube.com/watch?v=tWNgzLG9-2c)). Runway's "Introducing Continuum" (322 s).
- **LinkedIn**: Remotion's AI motion-graphics tutorial (1.6%). Remotion's "OpenAI just released new
  Plugins for Codex, and you can find us there" (1.05%). Jitter's "Jitter AI just got an upgrade
  with Claude Opus 5.5!" (0.64%).
- **Threads**: Canva's "#WhatsNew" feature videos (0.65%, from 2023; the account is dormant) and
  Figma's "iPhone Duo presets" (0.2%). This platform is low-yield for the whole category.

### Patterns that repeat

- **The hook is the product moment, not the product name**: "YES!", "how cool this is", "There's a
  new way to make videos". The demo carries the explanation. Text stays under about 120 characters.
- **"Introducing X" from the founder's account** gets about 2× lift, and the video is 20–100 s.
  The same launch on the brand account gets a fraction of that.
- **Made-with-the-tool outputs** (Runway shorts, Lovart prompt packs, Rive creator credits) beat
  feature explainers on Instagram.
- **Riding a partner's launch** (Claude, ChatGPT, Codex, Grok) gives the best brand-account
  results on LinkedIn and YouTube.
- **Build-in-public metrics and social proof** do well on founder X: funding, revenue, "moved
  offices twice", "Nike lists FLORA as a job requirement".
- **Community questions** ("should we open-source?", "who wants early access?") get 14–21% ER with
  no media at all.

### What flops

- **Plain text or link posts on LinkedIn** (0.42×) and **link-only posts on X**: Flora's brand
  posts "WIZARDRY Episode II [link]" got 9 engagements on 28k followers.
- **Threads and reply chains on X** (0.7–0.86×).
- **"Comment KEYWORD to get…" bait on Instagram** (0.63×).
- **Long YouTube walkthroughs from big brands**: Canva's median is 26 engagements on 918k
  subscribers. Framer's is 41 on 360k.
- **Off-brand or squatted handles**: Flora's, Krea's and Kittl's Instagram handles are owned by
  unrelated accounts. Reserve every handle.
- **Sunday posts on Instagram** (0.49×) and **Saturday posts on YouTube** (0.37×).

## Benchmarks: median ER per platform

Accounts active in the last 90 days with at least 1,000 followers, using account-level medians.

| Platform | Accounts | Median ER % | p25 | p75 | Format lift (median) |
|---|---:|---:|---:|---:|---|
| X | 16 | 0.19 | 0.07 | 1.43 | video 1.10, text 1.00, photo 0.91, link 0.88, thread replies 0.71–0.86 |
| Instagram | 8 | 0.18 | 0.08 | 0.28 | carousel 1.12, image 1.00, reel 0.98 |
| TikTok | 3 | 0.32 | 0.01 | 1.12 | video 1.00 (all) |
| LinkedIn | 12 | 0.05 | 0.02 | 0.15 | video 1.03, image 0.87, text/link 0.42 |
| Threads | 3 | 0.04 | 0.03 | 0.06 | video 1.07 |
| YouTube | 5 | 0.02 | 0.01 | 0.07 | Short 1.06, long 0.98 |

Hook lift (median, all posts): "Introducing" X 1.93× (n=22), Instagram 1.52× (20), YouTube 1.89×
(18). "New…" Instagram 1.18×. A question in the hook gives 1.08–1.09× on X and TikTok.

Timing (UTC, lift vs account median; small samples, so read these as hints): on Instagram, posts
06–12h (US early morning, EU midday) do best (1.45–1.6×, n=36) and Tuesday is the best day
(1.17×). On X, Thursday is best (1.07×) and 06–09h is the worst slot. On LinkedIn, Friday leads
(1.53×, n=9). On YouTube, Monday (2.7×) and 18–24h do best.

## Launch playbooks

### Flora (Weber Wong)
1. **Launch day**: the founder posts an 90 s "Introducing FLORA, Your Intelligent Canvas." video on
   Wed 17h UTC. It reached 633k views on an 11k-follower account. The brand account plays almost no
   part.
2. **Funding as a second launch**: "We raised $6.5 million…" with a 114 s video, 3 months later.
3. **A steady stream of social proof and positioning**: Nike job post screenshot, "moved offices
   twice in 2 months", "cool to see the rest of the AI creative world pivot to what we launched back
   in February", "build the Nike of creative tooling". Spicy industry takes ("rename Atlassian…",
   77k views) keep reach up between launches.
4. **The brand account (@floraai) posts episodic link drops** ("WIZARDRY Episode II") and model
   integrations ("Precise camera control with GPT-6 Astra"). These get low engagement. Reach is
   person-led.

### Krea (Victor Perez, Diego Rodríguez)
1. **Pre-launch**: "who wants early access? 👀" (14% ER), then "should we open-source?" (21%).
   Each is a one-line poll with no media.
2. **Launch**: a reaction-style video, "how fucking cool this is." (29 s, 388k views), plus a
   reply noting it runs on a smaller model than the official launch will. Then "it's out 🫡" and
   "btw we're hiring."
3. **Krea 3 (October 2026)**: LinkedIn event invite (10-16) → launch party post (10-20) → "today,
   Krea 3 makes it to the top of image arenas." on X with a 35 s video (1.32M views) → use-case
   follow-ups ("Krea 3 for e-commerce", "for product shots") → integration ("Krea for Grok bot").
   Benchmarks and arena rankings serve as the hook.

### Jitter
1. **The relaunch video**: "Introducing the all-new Jitter! 💫" (20 s, Tue 09h, 303k views, 10.6%
   ER, its best post ever).
2. **A fixed weekly rhythm on Instagram and LinkedIn**: "New this week: …" every Monday or Tuesday,
   a 3–6 s cut on Instagram plus a native video on LinkedIn (MCP beta, AI modes, model upgrades).
   Between those: "Customer spotlight" and before/after motion reels ("Your static designs deserve
   better than a simple fade in.", 2.1%).
3. **Model-partner tie-ins**: "Jitter AI just got an upgrade with Claude Opus 5.5!" is its best
   LinkedIn post. Events (Luma "[PLAY/PAUSE] Sessions") are linked in the bio.

## Playbook for feega

### Formats, ranked by expected return
1. **Founder "Introducing" launch video** on X and LinkedIn: 30–90 s, a 2–8 word hook, no feature
   list in the text. Keep for big moments: the canvas, MCP, motion.
2. **Feature micro-demo**: 10–30 s 9:16 clip on Instagram Reels, TikTok and YouTube Shorts, plus
   16:9 on X and LinkedIn. The hook is the result. Every file in `demos/` is this format.
3. **"New this week" weekly drop** (copy Jitter's slot), same day every week, bundling 2–3
   features. Post it as a carousel on Instagram (carousels beat Reels there).
4. **Made-with-feega outputs**: finished motion pieces with credit to the creator. These beat
   explainers on Instagram.
5. **Partner rides**: "feega MCP now works in Claude Code / Codex / ChatGPT", posted within 24 h of
   the partner's news.
6. **Build-in-public metrics** from the founder: tokens saved, render times, usage numbers.
   `feega-mcp-tokens` is the template for this.
7. **One-line community polls** before every launch ("who wants early access?").

### Cadence
- **Founder X**: daily, 1–2 posts, at least 3 a week with video.
- **Brand X**: 3–5 a week. **LinkedIn** (brand plus founder): 3–5 a week, native video, no bare
  links.
- **Instagram**: 3 a week (2 Reels, 1 carousel). **TikTok and YouTube Shorts**: cross-post the
  same 9:16 clips 3 a week. TikTok is uncontested in this category.
- **YouTube long-form**: 1 tutorial every 2 weeks ("Create motion graphics with AI – Simple
  tutorial" is Remotion's best video). **Threads**: mirror only.

### Hooks to reuse (forms that earned lift)
- "Introducing ___." / "There's a new way to ___."
- A reaction: "YES!", "this is so fun.", "how cool is this."
- A before/after line: "Your static designs deserve better than a simple fade in."
- A number: "Paste from Figma. 0 rebuilding." / "$X / N tokens instead of M."
- A question: "should we ___?", "who wants early access? 👀"

Avoid "Comment KEYWORD", link-only posts, threads that hold the main point in a reply, and
Sunday posts.

### Best times (UTC; feega targets the US and EU)
- **X and LinkedIn**: Tue–Thu, 14–17h UTC (US morning, EU afternoon). Friday is a good LinkedIn
  slot.
- **Instagram**: Tue–Thu, 09–15h UTC. **TikTok and Shorts**: 15–20h UTC.
- **Launches**: Tue or Wed, 15–17h UTC (Flora launched Wed 17h, Jitter Tue 09h, Krea Thu 14–15h).

### 14-day content calendar (from Mon 2026-10-26)

Assets: `~/Documents/feega-videos/demos/2026-10-25-*-{16x9,9x16}.mp4` and
`~/Documents/feega-videos/social/feega-{one-canvas,mcp-tokens}-{16x9,9x16}.mp4`.
"Short-form" means Instagram Reels, TikTok and YouTube Shorts (9:16). X and LinkedIn get 16:9.

| Day | Date | Asset | Channels | Format | Hook (draft) |
|---|---|---|---|---|---|
| 1 Mon | 10-26 | — | Founder X | community poll | "should feega's canvas run inside Claude Code?" |
| 2 Tue | 10-27 | `social/feega-one-canvas` | Founder X + LinkedIn (16:9) 15h, short-form 9:16 | **launch video** | "Introducing feega. Design, motion and AI in one canvas." |
| 3 Wed | 10-28 | `demos/figma-paste` | X, LinkedIn, short-form | micro-demo, before/after | "Paste from Figma. Keep every layer." |
| 4 Thu | 10-29 | `social/feega-mcp-tokens` | Founder X 15h, LinkedIn | build-in-public metric | "Same video. A fraction of the tokens." (put the real number first) |
| 5 Fri | 10-30 | `demos/component-variants` | LinkedIn, X, short-form | micro-demo | "Variants, now on the canvas." |
| 6 Sat | 10-31 | — | Founder X | made-with-feega | Repost a user or team piece, with credit |
| 7 Sun | 11-01 | — | — | rest | — |
| 8 Mon | 11-02 | `demos/combine-scenes` | short-form, X | micro-demo | "Two scenes → one video. Drag." |
| 9 Tue | 11-03 | Week bundle: `auto-width-text`, `rotate-corners`, `image-crop-adjust` | Instagram **carousel**, LinkedIn video, X | **"New this week"** | "New this week: auto-width text, rotate from corners, crop and adjust." |
| 10 Wed | 11-04 | `demos/comments-timeline` | LinkedIn 15h, X | micro-demo (teams) | "Comment on the exact frame." |
| 11 Thu | 11-05 | `demos/search-colour-tags` | short-form, X | micro-demo | "Find any asset by colour." |
| 12 Fri | 11-06 | `social/feega-mcp-tokens` (re-cut, partner angle) | LinkedIn, X | partner ride | "feega MCP: your agent now makes motion." Tie to the week's Claude, Codex or ChatGPT news |
| 13 Sat | 11-07 | — | Founder X | build-in-public | First-2-weeks numbers (signups, renders) |
| 14 Sun | 11-08 | — | YouTube (long) scheduled Mon | tutorial | "Make a motion video with AI in feega – beginner tutorial" (stitch the 8 demos) |

Each micro-demo runs about 15–30 s. Put the result in the first second. End with the feega
wordmark and no "link in bio" ask on X: the link goes in the first reply only on X, in the post
on LinkedIn.

## Methodology and limits

- **Collection**: ScrapeCreators endpoints were used:
  - X `/v1/twitter/user-tweets`
  - Instagram `/v2/instagram/user/posts`, paginated up to 4 pages
  - TikTok `/v3/tiktok/profile/videos`, up to 4 pages
  - Threads `/v1/threads/user/posts` and `/profile`
  - YouTube `/v1/youtube/channel-videos` and `/channel`
  - LinkedIn `/v1/linkedin/company`, `/company/posts`, and `/post` for engagement on the 5 latest
    posts per company

  Total: **233 calls**.
- **The X endpoint returns a profile's top or popular tweets, not the latest ones.** Founder
  samples therefore span years and are biased toward hits. They are valid for "what goes viral",
  not for cadence or typical ER. For brand accounts, only 1–12 of the returned tweets were the
  brand's own recent posts after removing retweets.
- LinkedIn engagement covers reactions and comments only (no reposts) and at most 5 posts per
  company. Instagram ER leaves out shares and saves, which the API does not return. TikTok saves
  are counted.
- Instagram and TikTok pages can include pinned old posts. Windows marked "dormant" reflect
  inactive accounts.
- The outliers (Runway's 138M-view reel, Lovart's 76k-engagement carousel) are kept in the data
  but called out. They look paid or boosted.
- Timing and hook analyses use small samples, often n<30 per cell. Use them as hints.
- Several expected handles were wrong, squatted or deactivated (listed above). Jitter's founders
  were not verified and are not included.
- **Personal data**: only public brand and public-figure accounts were collected. Comments and
  commenter names returned by the LinkedIn post endpoint were not stored.
