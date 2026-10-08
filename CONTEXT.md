# feega

feega is a social media AI autopilot: a team of specialist agents produces, publishes and improves content for a brand. This glossary fixes the language of that team.

## Language

### The team

**Main agent**:
A persistent specialist of the default team (Analyst, Content Creator, UGC Specialist, Motion Specialist, Web Specialist) or a custom agent hired by the brand. Lives in its own threads, keeps its identity and journal across turns.
_Avoid_: worker, instance, sub-agent.

**Subagent**:
A short-lived in-turn helper spawned by one main agent to split its own macro-task. Shares the delegating agent's goal and voice context; has no identity and no thread of its own.
_Avoid_: colleague, teammate.

**Generalist (feega)**:
The agent with no craft (agent = null). Routes and covers when no specialist fits; cannot open a user session of its own.
_Avoid_: omni, assistant.

**Custom agent**:
A brand-hired agent built on a specialist's craft, with its own name, face and routines. Gets a team thread of its own from the moment it is hired.
_Avoid_: scheduled agent, routine.

**Agent Kit**:
The one environment every main agent runs its turns in: a persistent session with its own tools, skills and memory, kept across all its threads. There is no second way to run a turn.
_Avoid_: harness, bridge, kit mode, engine.

### Threads

**Team thread**:
One persistent thread per main agent where it works with the user (`surface='team'`). Doubles as the agent's work journal: every routine run leaves its report there.
_Avoid_: agent chat, journal (journal is the role, not the object).

**DM (agent-to-agent)**:
The private thread between exactly two main agents. Coordination only: the work that concerns the user happens in a team thread. The user can read it but not write in it.
_Avoid_: private thread, private chat, room.

**Private thread**:
A thread where the user talks with exactly one main agent, away from the team.
_Avoid_: DM, direct message, one-to-one chat.

**Room (group chat)**:
A thread where several agents and the user talk in turns. Behind a flag; not the default surface.

**Onboarding thread**:
The setup thread (`surface='onboarding'`), one per brand, held by the Analyst. The only thread seeded when the brand is created.

### Collaboration

**Delegation**:
One main agent handing a job that belongs to another agent's craft to that agent — by DM message, never by doing the work itself with borrowed tools.
_Avoid_: assignment, forwarding.

**User session**:
A team thread opened by an agent that has work needing the person: it writes its opening line there and keeps working in it.
_Avoid_: open thread, handoff.

**First contact**:
A specialist's opening move toward a brand-new user: it declares the agent's craft and performs one concrete first action — never a greeting.
_Avoid_: welcome message, intro.

**Team contact (onboarding)**:
The server-guaranteed first contact of the specialists mapped to the brand's plan, delivered after the Analyst's setup turn. A product promise, not a model behaviour.
_Avoid_: fan-out, broadcast.

**Brand memory**:
The shared memory of a brand: facts, skills and notes any main agent can read and write. The place a notion lives when it must outlive the turn that produced it.
_Avoid_: context, knowledge base.

**Gallery item**:
A motion video or composition published to the public gallery: a snapshot of one revision plus a public copy of every file it uses, credited to the author's workspace (Feega for the demos). Never a live link to the author's project.
_Avoid_: template (a template lives in one workspace's library), share link (a share link opens the author's own canvas).

**Remix**:
A free copy of a gallery item into a project of the remixer, as a new motion node with its own files and its main texts, colours, logo and media exposed as fields. Withdrawing the original never touches it.
_Avoid_: fork, duplicate.

**Brand accent**:
The one colour a motion film adds to ink and paper. Read from the brand, never chosen: the first saturated colour (chroma ≥ 0.18) in this order, held by `ACCENT_ORDER` in `src/lib/motion/accent.ts`.

| Order | Source | Where |
|---|---|---|
| 1 | logo | svg fills or raster colours of the logo |
| 2 | favicon | favicon or apple-touch-icon |
| 3 | theme-color | `<meta name="theme-color">` |
| 4 | buttons | CSS rules on buttons, links, `.btn`, `.cta`, `primary` |
| 5 | css | custom properties and every other CSS colour |
| — | none | only neutrals: no accent, the neutral palette (ink, paper, muted, line) |

_Avoid_: an invented accent, a colour the agent picks because it suits the sector.
