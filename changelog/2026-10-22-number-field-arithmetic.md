# Number fields accept arithmetic

Inspector number fields took only a plain number. Figma and Jitter let you type
`100+20` or `(3+4)^2`. `parseDecimal` now runs a small recursive-descent parser
(`src/lib/motion/arithmetic.ts`): `+ - * / ^`, parentheses, unary minus, comma as
decimal point. Division by zero or a malformed expression returns null, so the
field keeps the typed text as before. Discarded: `eval`/`Function`.
