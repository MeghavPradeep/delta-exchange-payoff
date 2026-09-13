# The split, what to do next

Open tickets only. Each item names the file or the command. Numbers carry their tag.
**The GitHub issues are the state of record** and win over this file. Rewritten 2026-09-14.

## Do now, in this order

1. **Done 2026-09-14:** #118, #119 and #110 landed and closed; #120's rebuild runs `7783a4b`;
   #79 closed on the owner's amended criterion (5h12m, not a day). Suite 1,610 with Docker up.
2. **#121 — a pause loses the open minute from `reference-bars` and `spot-bars`.** Found live on
   2026-09-13. **#63 stays open on its criterion 5 until #121 lands**; criteria 3 (a hard kill at
   19:28:30Z lost nothing in any table) and 4 (amended) are met. Establish the mechanism first.
3. **#122 — the api's minute pass skipped `computed.chain` for 19:04** and records why only in
   counters `/health` does not expose. Not reproduced. Make each pass write a record before fixing.
   Also unticketed: after release, a seal following an awaited command commit in `BarWriter.run`
   can use the wall clock with the queue undrained (#119's note). Unmeasured.
4. **Get AWS credentials.** #70's criteria 2–4, #71 and #80 cannot start without them. #70's
   closing comment lists exactly what a person with credentials runs, in order.
5. **Decide the epic.** #57 closes when #70, #71 and #80 do. Nothing else blocks it.

## Open, ranked by what it costs to leave alone

| # | What it is | Why it matters |
|---|---|---|
| **#121** | A pause keeps the open minute in `quote-bars` only, silently | A recording contract promise broken, with no counter to show it |
| **#122** | The minute pass dropped a minute with no log | `computed-bars` holes that neither `api` nor `store` can explain |
| **#63** | Open on criterion 5 alone | Closes when #121 does |
| **#70**, **#71**, **#80** | Store to S3, deploy prod, measure the hop | AWS credentials |

## Parked by the owner — do not start

- **IV/RV:** #31, #54, #116 (`hld.md` still names `/iv-vs-rv`, which 404s — that is #116).
- The worktree `D:/Convex Hedge/dxp-54` (`rv-backfill`) belongs to that work. Leave it.

## Not yet triaged

**#1, #6, #7, #8** — the original build-and-measure study. No comments. Much of what they ask
for appears built; none carries closing evidence. #8's historical vol surface may fall under
the IV/RV pause; ask the owner before starting it.

## The one thing to carry forward

**The defect shape here is not a crash. It is a value that quietly stopped meaning what it says.**

Eight instances were found on 2026-09-12. A counter that still increments. A status field that
is a literal. An exception a defensive handler swallows. A rule that silently became a special
case. **Every one of them left the system reporting success.**

Five questions found all eight. Use them:

1. **Ask the dependency, not the process.** `docker exec dxp-redis redis-cli XINFO GROUPS <stream>`
   tells you what a `/health` route cannot.
2. **Ask what has never executed.** `git log -S <symbol>`, read against the tests that claim to
   cover it. Record 0010 R4 had never once run.
3. **Ask where a denominator comes from** — the data, or the request. A stall shortens a span
   rather than holing it.
4. **Ask what a counter reads if the thing it counts never happens.** Usually zero, which reads
   the same as healthy.
5. **When an A/B result comes out clean, ask what else differs between the arms.**

**And one rule for tests: mutate, do not read.** Delete the guard, no-op the commit, force the
cadence, revert the fix. A test that stays green under the mutation it claims to catch is the
finding. Ten were found here this week and none by inspection.

## Next action

Read #121's evidence, then write its bus-seam test that pauses with a minute open in all four aggregators.
