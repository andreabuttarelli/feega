# AI and chat at 1.2x provider cost

`AI_MARKUP` 1.0 -> 0.2 and `CHAT_MULTIPLIER` 4 -> 1.2, an explicit pricing
decision. $1 of provider cost now bills 120 credits (was 200 for AI, 400
for chat). `RENDER_MULTIPLIER` (5x) is untouched.

- `MULTIPLIER_FLOOR` (4) now guards renders only; chat is pinned at 1.2.
- `MARGIN_FLOOR` 0.35 -> 0.15: a rung's margin is `markup / (1 + markup)`
  = 16.7%, not reachable at 35% by construction. Margin beyond that
  depends on credits left unspent.
- `CREDITS_PER_USD_SUBSCRIPTION_LIST` 200 -> 120, so `ACCOUNT_SEAT_CREDITS`
  2200 -> 1320. Catalogue prices derive from it and fall by 40%.
- Home pricing "~60 pictures" for EUR 8 is now "~100".
