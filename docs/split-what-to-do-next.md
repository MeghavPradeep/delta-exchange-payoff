# The split, what to do next

Open tickets only. Each item names the file or the command. Numbers carry their tag.
**The GitHub issues are the state of record** and win over this file. Rewritten 2026-09-14.

## Do now, in this order

1. **Land #119 and #118.** #119 holds a restarted `store`'s seal clock at its replay frontier, so
   the minute open at a restart is folded exactly once into all four tables. It closes **#110**,
   whose only open criterion it is. #118 settles the two figures that carry two tags.
2. **Rebuild and restart the stack — #120.** Run `python tools/loadgen.py check`, then
   `docker compose -p dxp build` and `docker compose -p dxp up -d`, timed to a store flush
   boundary. That deploys #107, #108, #110, #111, #115 and #119 together. Record `XINFO GROUPS
   md.option_bar:DELTA:BTC` pending before and after, and read back the first `store.checkpoint`
   start-up record. **A 503 from `feed` or `discord-alerts` afterwards is intended**, not a regression.
3. **Close #63 and #79 on the owner's amended criterion.** Both asked for one full day of
   recording. The owner accepted the evidence already taken on 2026-09-12: 348 minutes with
   zero interior computed-bar misses (#63), and a 5h12m window holding the busiest hour (#79).
   #63 waits on #119, because its restart criterion is the minute #110 lost.
4. **Get AWS credentials.** #70's criteria 2–4, #71 and #80 cannot start without them. #70's
   closing comment lists exactly what a person with credentials runs, in order.
5. **Decide the epic.** #57 closes when #70, #71 and #80 do. Nothing else blocks it.

## Open, ranked by what it costs to leave alone

| # | What it is | Why it matters |
|---|---|---|
| **#120** | The running images predate six merged fixes | Until rebuilt, #111's pending-list loss resumes the moment the stack starts |
| **#119** | A seal pass during replay loses the minute open at a restart | A seal is final; `store.empty_generation` only makes it visible |
| **#110** | Held open on its criterion 2 | That criterion **is** #119 |
| **#118** | `1.0888` and `1,056.4` each carry two tags | 1.0888 is what record 0008's 2.8-core threshold is read against |
| **#63**, **#79** | One criterion each asked for a full day | Closing on an amended criterion, above |
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

Read `gh issue view 120`, then run `python tools/loadgen.py check`.
