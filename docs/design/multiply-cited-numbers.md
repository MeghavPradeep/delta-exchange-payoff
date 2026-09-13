# Multiply-cited numbers: the sweep, and what it found

**#105's real deliverable, per its own acceptance criterion 5**: not the one number the ticket
named, but the check that finds every number shaped like it — cited with a tag in two or more
documents, where the tags disagree. **#112 widened it**: the allowlist could only grow, and the
sweep could not read this repository's own numbers-table shape.

The check itself lives in
[`engine/tests/test_cloud_numbers.py`](../../engine/tests/test_cloud_numbers.py) as
`_multiply_cited_tag_disagreements`, and runs on every test collection —
`test_the_multiply_cited_figure_sweep_finds_no_new_disagreement`. A second test,
`test_no_allowlist_entry_has_gone_stale`, checks the allowlist itself. This file is that sweep's
output, `measured` 2026-09-12 at #112's `HEAD` and updated by #118 on 2026-09-13, kept as the
readable record instead of only the report. **Quote a number's disagreement from here or from the
test's docstrings; the full per-number reasoning lives in the test's `_KNOWN_MULTIPLY_CITED` and
is not restated.**

## 1. Method, in short

A number is a candidate if it is specific enough not to collide by coincidence — four or more
significant digits, or two or more fractional digits (`1,849.8` qualifies; `30 minutes` and
`50 ms` do not) — and it is cited with a `measured`/`derived`/`assumed`/`unmeasured` tag in
**two or more files** under `docs/`. Its tag is read two ways: `_nearest_tag` first, within the
number's own table cell or the same sentence; failing that, `_column_tag` checks whether the tag
instead sits in a column of its own beside the figure's — this repository's other numbers-table
shape, `| Number | Tag | Run |`, the one #62, #63 and #81 built moving evidence out of design
notes into siblings (`hld-evidence.md`, `store-numbers.md`, `message-bus-numbers.md`,
`compute-numbers.md`, `data-feed-engine-numbers.md`, and more). Either way, a row citing several
different tagged quantities side by side does not cross-attribute one's tag to another: a column
neighbour counts only if it is *exactly* one tag and nothing else.

**This is an approximation, the same way #95's `CONDITION_WINDOW` pin is.** #105's first pass, a
naive "any tag on the line," flagged over 70 numbers; reading every one by hand found exactly one
real disagreement. #112's column-tag pass added nine more candidates; §5 lists the eight that
resolved to the same shape of false positive, one column over, and §4 carries the one that did
not.

## 2. Fixed

| Figure | Ticket | Sites | Now |
|---|---|---|---|
| 1,849.8 events/s | #105 | `message-bus-numbers.md`, `redis-hosting.md` (×2), `decisions/0010-store-replay.md`, `lld/redis-bus.md`, `lld/store-replay.md`, `research/0001`, `research/0005`, `research/0005b`, `research/0007-load-profile.md` (×2) | **`derived` everywhere.** `redis-hosting.md:111`, `decisions/0010-store-replay.md:97` and `lld/store-replay.md:191` corrected; the last also named the wrong run and is corrected to #58's arithmetic |
| 5,511 ms | #112 | `docs/storage.md:135`, `docs/design/research/0010-store-replay.md:119`, `docs/design/lld/store-numbers.md:12` | **`derived` everywhere.** `storage.md` already had it right (5,001 ms + `ob_l2`'s measured 510.3 ms). `research/0010-store-replay.md:119` called it a `measured` max arrival lag — corrected. `lld/store-numbers.md:12` attributed the ceiling to the measuring tool directly — corrected to name it as `storage.md`'s arithmetic |
| 1.0888 cores | #118 | `research/0007b-container-measurement-numbers.md:65`, `research/0007a-container-measurement.md:132`, `compute.md:191`, `decisions/0005-compute-and-region.md:191`, `decisions/0008-topology.md:156` | **`derived` everywhere.** `0007b`'s ledger was right — a sum of six `measured` means is computed, not observed. The other four called the total `measured`; all four corrected. 0008 and 0005 also carry an appended note, since a tag correction inside a decision record's own sentence is still a correction |
| 1,056.4 MiB | #118 | `decisions/0007-load-profile.md:37`, `research/0007-load-profile.md:75` | **`measured` everywhere**, and the research cell reshaped so the sweep can read it — see §7 |

Full evidence: `test_1849_8_events_per_second_is_derived_everywhere` (1,849.8),
`test_1056_4_mib_cell_is_readable_by_the_sweep` (1,056.4, cell shape), and the #112 and #118
issue threads. 1.0888 has no dedicated pin: once every site agreed, the general sweep in §1
covers it the same as any other figure, which is the point of building a sweep instead of a pin.

## 3. Settled by discovering the disagreement no longer exists

**`240.8 MiB` was #105's other OPEN entry, and it is a second dead-entry case — the same shape as
`1.45` (§6), found by the same discipline: verify against the file, not the report.** At #112's
filing (`9f0084f`), `compute.md`'s load-profile table read `240.8 MiB / 1,056.4 MiB \`measured\``
in one cell, against `research/0007-load-profile.md:74`'s `derived`. Commit `26e24dd`, landing
*after* that `HEAD` but before this ticket started, restructured the table: it added a `1×
\`measured\`` column of real container measurements and dropped the inline `\`measured\`` tag from
the `240.8 MiB / 1,056.4 MiB` cell, which now sits under a `1× \`derived\`` column header instead.
Both documents now say `derived`. Nothing needed correcting; the entry needed removing, and the
sweep no longer flags either figure. `git log -S"1.45" -- docs/design/lld/store.md` names #107 for
the first dead entry; `git log 9f0084f..26e24dd -- docs/design/cloud/compute.md` names #79 for
this one.

**The lesson is general, not particular to `240.8`: an allowlist entry can die of a fix it never
knew about.** Nobody editing `compute.md` for #79 was thinking about #105's allowlist, and nothing
obliged them to be — the entry died as a side effect of an unrelated, correct change. That is
exactly why `test_no_allowlist_entry_has_gone_stale` (§6) checks every entry on every run rather
than trusting whoever last touched a cited site to remember an allowlist exists.

## 4. Found in #112, fixed in #118

`1.0888` and `1,056.4` (§2) sat here as `out_of_scope_noticed` from #112 through #117: one a real,
readable disagreement outside that ticket's territory, the other invisible to the sweep entirely.
#118 fixed both; see §2 for the sites and §7 for why `1,056.4` needed a shape change, not just a
tag change. Nothing is open here as of #118.

## 5. Candidates that are not real disagreements

In each, the "second" tag belongs, on inspection, to a different number sharing the same cell,
row or sentence — not to the number in the left column. Full reasoning per figure is in
`_KNOWN_MULTIPLY_CITED`; not restated here.

| Figure | What the nearby tag actually belongs to |
|---|---|
| 1,000 | a different, unrelated "1,000" — round-number coincidence between a cost model and a throughput figure |
| 0.05 core | the 2.00-core figure it is scaled into |
| 843.4 KB/s | the monthly-GB figure computed from it |
| 30.89% | the per-service point values computed from it |
| 0.71 core | none — documented and intentional (§9 of `research/0007-load-profile.md`) |
| 1,152 objects/day | "the day" (the flush-file count basis), a different quantity |
| 1.45 (grace multiplier) | no site tags it at all — every citation's nearest tag is the adjacent transit figure (in-cell) or the row's own grace-value tag (column) |
| 40.77% | the adjacent 29.96-point figure in the same cell |
| $78.07 | the oms/strategy addition layered on top of it |
| 156.2 ticker frames | the adjacent 1,693.6 frames/s figure in the same source cell |
| 7.25 ms | the 58 ms product computed from it |
| 0.002% | a 6.9 Mbit/s figure later in the same cell (column: a genuine, different-row `measured` tag elsewhere) |
| $0.056/GB | the row's own GB/month and $/month total, not the AWS rate cited as an input |
| 0.321 s | the row's own 44.785 s headline (column), or the 47x ratio computed from it (in-cell) |
| 1,693.6 frames/s | the row's own 1,051.5 MiB working-set forecast, one column over |
| 200,000 entries | the "108 s of traffic" computed by reusing the constant, not the constant itself |
| 44.785 s | the row's own staleness/grace thresholds (15 s, 30 s), one column over |
| 5,001 ms | the row's own 1,849.8 events/s, one column over |
| 724.8 KB/s | the row's own 0.86x run intensity, one column over |

## 6. Why the allowlist itself needs checking, not just what it explains

`1.45` sat in `_KNOWN_MULTIPLY_CITED` citing `lld/store.md:46`. #107 deleted that line five hours
after #105 wrote the entry down, and nothing noticed: the old sweep only ever asked "is every
*disagreement* explained," never "does every *explanation* still describe a disagreement."
`test_no_allowlist_entry_has_gone_stale` asks the second question — red on `1.45` (and, it turned
out, on the now-resolved `240.8`) before the fix, green after. The entry above is re-cited
against sites that still exist.

## 7. Why #95's tripwire did not catch 1,849.8, why #112 still could not see everything, and how
   #118 closed the `1,056.4` gap

`test_cloud_numbers.py` before #105 held two pins, both written by hand after #95 found a
specific defect. Neither asked the general question. §1's sweep is the general form.

**Reading the tag column (#112) is not the same fix as widening the proximity window, and
widening the window is not free.** `_TAG_PROXIMITY` at 30 adds four disagreements; at 40, ten —
and several of those are the heuristic attaching a neighbour's tag to the wrong number, the same
failure mode §5 catalogues. `_column_tag` is scoped instead: only the two immediate cells, and
only when a neighbour is *exactly* one tag.

**That scope is why `1,056.4 MiB`'s decisions-vs-research disagreement stayed invisible through
#112.** `decisions/0007-load-profile.md:37` tagged it `measured` within its own cell, found
normally. But `research/0007-load-profile.md:75`'s cell read `**1,056.4 MiB** at 30 min, 2 GiB
ceiling \`derived\` M4` — the tag sat 32 characters from the number, past prose describing a
*different* fact (the 2 GiB ceiling) in the same cell. It was neither a same-cell match (too far)
nor a column match (no neighbouring cell; one dense prose cell), so the sweep's aggregate tag set
for `1,056.4` never gained a second value and the token never appeared as a disagreement.

**#118's decision: forbid the shape, don't parse it.** Two ways to close this were open. (a)
Teach the sweep which fact inside a multi-fact cell a trailing tag belongs to — real clause
parsing, not proximity or position, and a materially larger change than `_column_tag`. It would
also solve nothing for a *reader*: a cell that states two facts under one tag is exactly as
ambiguous to a person as to a parser, so a correct parser papers over a writing problem instead of
fixing it. (b) Forbid a cell from stating two facts behind one shared trailing tag — each fact
gets its own adjacent tag, or the second stays untagged if it needs no citation of its own — and
fix the one offending cell now.

**#118 chose (b).** It is cheaper today — a documentation edit, not a new parsing pass over
`_column_tag`'s two-neighbour scope — but it is not a one-time fix the way a parser would be: the
next dense cell written this way needs its own edit, so the cost is paid again, in more files,
each time the shape recurs, rather than once in the sweep's code. That trade was made deliberately:
a rule a person can apply while writing ("one tag per fact, next to the fact") is worth more here
than a parser that would still leave the source ambiguous to read. `research/0007-load-profile.md`
§4's Redis memory cell now reads `**1,056.4 MiB** \`measured\` M4 at 30 min; 2 GiB ceiling` — the
measured figure carries its own tag; the ceiling, sourced to 0002 elsewhere, needs none here.
`test_1056_4_mib_cell_is_readable_by_the_sweep` pins the result at the mechanism: it calls
`_nearest_tag`/`_column_tag` on the real cell and asserts a tag comes back, red against the
original cell and green after the split. The general sweep in §1 confirms the figure now agrees
everywhere (§2) — a consequence of fixing the tag, not of the shape fix by itself.

## 8. What this check still cannot see

Naming a blind spot is worth more than believing there are none. Besides multi-fact cells
(§7, now forbidden rather than parsed), the sweep as it stands cannot see:

- **A number and its tag split across lines.** `_nearest_tag`/`_column_tag` both operate on one
  line (one table row, or one line of prose) at a time. Hand-wrapped prose that puts a number on
  one line and its tag on the next — exactly what this file's own §7 did in an earlier revision,
  describing `1,056.4`'s cell across a line break — is invisible the same way a too-far same-cell
  tag is, and for the same underlying reason: the sweep never looks past one line.
- **A tag not spelled as a bare backtick-quoted word.** `_TAG_RE` matches only `` `measured` ``,
  `` `derived` ``, `` `assumed` `` or `` `unmeasured` ``, in backticks, unqualified. "measured
  0.5% high" in running prose, or a tag inside a longer backtick-quoted phrase, matches nothing.
- **A figure cited only once, or consistently wrong everywhere.** The check is a *disagreement*
  detector: it needs two or more files with a readable tag before it can compare them. A number
  wrong in its one citation, or wrong the same way in every citation, produces no disagreement to
  find — this class needs a different check, not a wider one.
- **A tag more than one column away.** `_column_tag` reads only the two immediate neighbours.
  This repository's numbers-table shape has never needed a third column between a figure and its
  tag, but nothing enforces that; a future table that does would defeat it silently.
- **Two candidate tags in the same cell.** `_column_tag` deliberately returns nothing when both
  neighbours are pure tags and disagree (`_PURE_TAG_RE`'s `len(candidates) == 1` check) — the
  right call against false positives, but it means a genuine disagreement expressed exactly this
  way would also go unflagged.
- **A coincidental match on unrelated quantities.** `_specific` (§1) cuts most round-number
  collisions, but two independently precise figures that happen to share four significant digits
  would still merge into one token, in either direction: a real disagreement could hide behind an
  apparent one, or vice versa. §5's `1,000` entry is the mild form of this that surfaced by luck.
