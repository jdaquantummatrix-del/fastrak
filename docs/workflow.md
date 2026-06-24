# How I Work — the fastrak workflow

My personal operating manual for building fastrak with Matt Pocock's skills. The point:
**stop deciding the process each time.** Every piece of work follows the same loop, so I never
again build a slice off-process the way I built Customer (slice 1).

Deep version: the lesson library in `learning/matt-pocock-workflow/explainers/index.html`.
This page is the short, everyday cheat sheet.

---

## The loop (one picture)

```
  ① DEFINE DOMAIN → ② PLAN → ③ BREAK DOWN → ④ BUILD → ⑤ CHECK → (loop back to ②)
```

| Stage | When I'm here | I run | It produces |
|-------|---------------|-------|-------------|
| ① Define domain | A new word/decision shows up | `/grill-with-docs` | `CONTEXT.md` term, an ADR |
| ② Plan | I have an idea, not a spec | `/to-prd` | a PRD issue on GitHub |
| ③ Break down | I have a PRD | `/to-issues` then `/triage` | small tickets, labelled |
| ④ Build | I have a `ready-for-agent` ticket | `/tdd` (or `/diagnose` for a bug) | code + a passing test |
| ⑤ Check | Code is written | `/review`, then `/qa` later | verified work; new issues |

The loop is a **wheel**: `/qa` findings and architecture cleanups (`/improve-codebase-architecture`)
come back as new PRDs/issues.

---

## Per-feature checklist (copy this for every slice)

```
SLICE: ____________________________

[ ] ① Words clear? New domain terms → /grill-with-docs (update CONTEXT.md / docs/adr)
[ ] ② /to-prd — write the spec, file it as a GitHub issue
[ ] ③ /to-issues — slice into VERTICAL tracer bullets (each demoable on its own)
[ ] ③ /triage — label each: ready-for-agent / ready-for-human
[ ] ④ /tdd — build the slice test-first (red → green → refactor)
[ ] ⑤ /review — check it against the PRD + repo standards before it's "done"
[ ] Demo it: open the app and SEE it work
```

If I can't tick "demo it," it wasn't a real vertical slice. Re-slice.

---

## What to run when (decision cheat sheet)

| Situation | Skill |
|-----------|-------|
| "I have a rough idea for a feature" | `/to-prd` |
| "I want to change/clean existing code" | `/request-refactor-plan` |
| "I have a spec, need tickets" | `/to-issues` |
| "What should I work on / is this ready?" | `/triage` |
| "Time to build this ticket" | `/tdd` |
| "It's broken / throwing / wrong" | `/diagnose` |
| "Is my change correct + clean?" | `/review` |
| "I'm clicking around finding bugs" | `/qa` |
| "I'm lost in this code" | `/zoom-out` |
| "This area feels tangled" | `/improve-codebase-architecture` |

---

## Per-session ritual

**Start (2 min):** What slice am I on? Run `/triage` ("what's ready?") to pick the next ticket.
**During:** Stay in ONE stage at a time. Don't jump to code before there's a ticket.
**End (2 min):** Did I leave a demoable slice? Run `/review` on what I changed. Note the next step.

---

## Definition of Done (a slice isn't "done" until…)

1. It's demoable — I can open the app and see the behaviour work.
2. It has a test that proves it (so future changes can't silently break it).
3. `/review` passed — matches the PRD, follows repo conventions.
4. The originating issue is closed.

---

## Solo + AI notes

- I'm one person + AI agents. **Prefer `ready-for-agent`**: spec a ticket well enough that an agent
  can build it cold, then let it. I spend my time on `ready-for-human` (decisions), not typing.
- A good `/to-issues` ticket is the leverage point — the better the ticket, the less I do by hand.

---

## Honest debt: slice 1 (Customer)

Built off-process: no PRD, no tests, no review. It works, but it doesn't meet Definition of Done
(no test, no review). **From slice 2 onward, every slice goes through the loop above.** Slice 1's
missing test/review get picked up when we touch Customer again.
