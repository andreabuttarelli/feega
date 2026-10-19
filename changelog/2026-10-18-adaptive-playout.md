# Adaptive playout delay for peer motion

#799 drew peers a fixed three message gaps behind (≈100 ms at 30 Hz).
Now each track measures how late every sample arrives relative to the
fastest one seen (an exponential average of the lateness) and aims for
one median gap plus 2.5× that jitter, between 30 and 250 ms. The delay
eases towards the target (8 % per sample, at most 10 ms per step), so a
change in network conditions never makes the motion jump. It starts at
100 ms until it has measured.

Two-browser e2e (`peer-smoothness.spec.ts`, 3 runs each; latency is the
end-to-end lag inferred from where on the circle the drawn cursor is):

| | latency | deviation from a smooth path | frozen frames |
|---|---|---|---|
| fixed delay (#799) | 167–176 ms | 1.0–1.4 px | 3.9–5.7 % |
| adaptive | 139–143 ms | 1.2–1.5 px | 3.0–4.5 % |
| before #799 | — | 2.2–2.7 px | 21–35 % |

About 30 ms less lag for a slightly rougher path; on a jittery link the
delay grows instead of the motion stuttering.
