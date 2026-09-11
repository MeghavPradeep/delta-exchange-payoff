# Payoff feature — implementation plan

Spec: `docs/superpowers/specs/2026-09-10-payoff-design.md` — the binding authority. Where
this plan and the spec disagree, the spec wins. Where an issue and either disagree, the
issue wins (`CLAUDE.md`).

Each task below is one GitHub issue, published on `MeghavPradeep/delta-exchange-payoff`.
Branch: `feature/payoff`.

| Task | Key | Issue | Title | Blocked by |
|---|---|---|---|---|
| 1 | P1 | #9 | The payoff contract | — |
| 2 | P2 | #3 | The pure payoff core | Task 1 |
| 3 | P3 | #4 | `POST /analyse`, live and stored | Task 2 |
| 4 | P4 | #5 | Picking legs on the chain | Task 1 |
| 5 | P5 | #6 | The analyse screen | Tasks 3, 4 |
| 6 | P6 | #7 | Editing, and keeping up with the market | Task 5 |
| 7 | P7 | #8 | The low-level design, and the numbers | Tasks 5, 6 |

## Global Constraints

**Method — test-driven, one vertical slice at a time.**

- Red before green. Write the failing test, watch it fail for the reason you intended, then
  write only enough code to pass it. Never write the implementation first.
- One seam, one test, one minimal implementation per cycle. Never write all the tests and
  then all the code — that pins the shape you imagined rather than the behaviour you built.
- Expected values come from an independent source of truth — a worked example, a literal from
  the spec, a hand-computed figure. Never recompute the expected value the way the code
  computes it.
- Test at the seams this feature agreed, and no others: the pure payoff core, the route under
  `TestClient`, the URL codec, and a DOM fingerprint of the ladder.
- Refactoring is not part of the red-green loop; it happens under review.

**Environment.**

- Engine: `engine/.venv/bin/python`. Run the suite with
  `cd engine && .venv/bin/python -m pytest -q`, lint with `.venv/bin/python -m ruff check .`.
  Serve with `--app-dir src`; there is no install step for the package.
- Web: **bun**, never npm and never pnpm. `bun run typecheck`, `bun run build`, `bun test`.
  `node` is not on PATH here; use bun.
- CORS admits only port 3000. `DELTA_LIVE_FEED=0` serves the routes without a socket.

**Rules that bind every task.**

- **No test may touch the network.** `engine/tests/conftest.py` replaces the async client
  factory with one that raises; do not defeat it.
- **No test reads the wall clock.** Inject the instant.
- **`data/` is read-only.** Tests that need a store build one on `tmp_path`.
- **Every decimal crosses the wire as a JSON number or `null`, never a string.** The engine
  converts once, at the boundary. The web app never calls `parseFloat`.
- **`null` is not `0`.** An absent quote is `null` even where Delta spells it `"0"`. A real
  zero in `oi` or a Greek stays `0`.
- **Unbounded is `null`**, never an infinity and never a large sentinel.
- **Delta's own IV and Greeks are reference columns only and are never consumed as inputs.**
  `engine/tests/test_no_delta_inputs.py` pins this and must keep passing.
- **Greek conventions are this project's, not the textbook's and not the sibling's**: delta
  and gamma undiscounted; vega and rho discounted and per one percent; theta a
  **one-calendar-day** repricing on ACT/365. A 1/252 trading-day year overstates theta by
  **1.456x** here because crypto trades weekends. `TRADING_DAYS_PER_YEAR = 252` from
  `convex-hedge-payoff/src/payoff/pricing.py` must never be copied into this repository.
- **IV is a decimal fraction on the wire and a percentage on screen.** The engine never
  multiplies by 100.
- **`contract_value` (0.001) is a lot-size multiplier applied at the very end and never
  inside a pricing calculation.** The engine returns per-underlying numbers; the screen
  multiplies. Delta India options are vanilla, linear, USD-settled — no inverse correction.
- **`spot` is Delta's top-level `spot_price`;** `greeks.spot` is never exposed.
- **Never forward-fill.** A minute with no arrivals produces no row.
- **The web app computes nothing** beyond layout and rendering. Drawing a straight line
  between two given points is rendering; solving anything is not.
- **Read source, not READMEs** — including `CLAUDE.md`. Four documents in this repo are known
  to have fallen behind the code.
- **Tag every number `measured`, `assumed` or `derived`,** naming the run that produced it.
- **Documentation notes stay under 200 lines.**
- **Commits carry the repository owner's name only.** No AI or assistant attribution in
  commit messages, trailers or PR descriptions. Commit to `feature/payoff`; never push, never
  merge, never touch another branch.
- Do not dispatch subagents of your own.

**Shape of the feature** (from the spec, so no task has to re-derive it).

- A leg is a canonical instrument string, a direction (+1/-1), a positive integer quantity
  and an optional entry price. `events.instrument.Instrument.from_canonical` is the single
  validator.
- One expiry per strategy. Mixed expiry is a 422 naming both series (#2).
- Buy enters at the **ask**, sell at the **bid**. Never the mid, never `ltp`, never the mark
  (#1). A leg with no quote on its side and no supplied price refuses the whole analysis.
- The curve travels as **corner points** plus the two end slopes, not as samples.
- The window is **+/-3 sigma** from the at-the-money IV and the time to expiry, widened to
  include every strike carrying a leg.
- One line only: P&L at expiry. No value-today line, no target-date slider.
- Live when the link names no minute, static when it does.
- Nothing is stored. No new table, no new event.


## Task 1 — P1 (#9): The payoff contract

Part of the payoff feature. Spec: `docs/superpowers/specs/2026-09-10-payoff-design.md`.

### Concept

A contract document is the authority both halves are built against, and it exists before
either half. `docs/chain-contract.md` set that precedent for the ladder and `web/lib/contract.ts`
mirrors it field for field; this ticket does the same for the payoff.

The document answers four questions and nothing else: what a leg is, what `POST /analyse`
returns, what units those numbers are in, and what it refuses.

### Why this way

The engine and the screen are written by different hands at different times, and the only
thing keeping them in step is a document neither one owns. Writing the models first and
the prose afterwards inverts that: the prose becomes a description of whatever the models
happened to do, which is how `web/README.md` came to describe a Refresh button that has not
existed since `8280083`.

The curve travels as **corner points**, not samples. A single-expiry payoff is piecewise
linear — straight everywhere, kinked only at a strike — so the kinks plus the two end slopes
are exact, smaller on the wire, and zoomable without limit. Drawing a straight line between
two given points is rendering, not arithmetic, so `web/`'s rule that it computes nothing holds.

### Learn first

- `docs/chain-contract.md` — the shape a contract document takes here, and its refusal table.
- `web/lib/contract.ts` — how a mirror is written, and what `ContractViolationError` is for.
- `docs/settlement.md` §on `contract_value` — why the multiplier is applied at the very end
  and never inside a pricing calculation.
- `engine/src/deltapayoff/events/instrument.py` — `Instrument.from_canonical`, the single validator
  for a leg's name.
- The sibling's `src/payoff/models.py` for the shape only. Its `Finite`/`Unbounded` annotated
  types are worth stealing; its 252-day year is not.

### Task

1. Write `docs/payoff-contract.md`:
   - **A leg**: canonical instrument string, `direction` (+1 buy / -1 sell), `quantity`
     (positive integer), optional `entry_price`.
   - **The request**: an ordered list of legs, plus an optional `as_of` minute. No `as_of`
     means live.
   - **The response**: the echoed strategy, the curve as `corners` + `slope_left` +
     `slope_right` + `window`, the four metrics (max profit, max loss, breakevens, net
     premium, reward:risk), per-leg entry and Greeks, total Greeks, the payoff table, and
     the `forward`, `discount`, `spot`, `expiry`, `underlying`, `contract_value` and `as_of`
     it was priced against.
   - **Units**: every number is per one unit of the underlying. `contract_value` is echoed so
     the screen can multiply. The engine never multiplies.
   - **Unbounded is `null`**, never a large number and never an infinity.
   - **The refusal table**: mixed expiry, an instrument not listed, a leg with no entry price
     and none supplied, an empty leg list, a malformed canonical string — each with its status
     code and what the message must name.
2. Add the Pydantic request and response models to the engine. No route yet.
3. Mirror them in `web/lib/contract.ts` (or a sibling module), including the
   `ContractViolationError` check that every decimal arrived as a number.

### How you will know

- [ ] `docs/payoff-contract.md` exists and describes request, response, units and refusals.
- [ ] The response models reject a non-finite float and reject a curve whose parallel arrays
      disagree in length.
- [ ] A test builds a full response object from a hand-written literal and round-trips it
      through JSON with no field lost and no decimal arriving as a string.
- [ ] `bun run typecheck` passes with the mirror in place.
- [ ] `ruff` clean, whole engine suite green.

### What to notice

Whether writing the refusal table first changes what you think the feature is. The sibling
project's contract has five refusals and four of them were discovered during implementation
rather than design — see whether the same happens here, and if it does, come back and say
which one the document could not have predicted.

### Blocked by

None — can start immediately.


## Task 2 — P2 (#3): The pure payoff core

Part of the payoff feature. Spec: `docs/superpowers/specs/2026-09-10-payoff-design.md`.

### Concept

The arithmetic that turns a list of legs into a line and four numbers. Legs in, corner
points and metrics out. No socket, no clock, no filesystem — the same rule that keeps
`forward.py`, `black76.py` and `bars.py` testable in milliseconds.

At expiry every leg's value is its intrinsic value, so the strategy's P&L is a sum of
hockey sticks: straight everywhere, kinked only at a strike. That is why the curve can be
sent as its corners rather than sampled.

### Why this way

Because it is the only part of this feature that can be wrong quietly. A route that returns
a 500 announces itself; a breakeven that is fifty dollars out draws a perfectly plausible
chart. Putting it on the pure side means the interesting cases — unbounded versus finite, a
breakeven landing exactly on a strike, a strategy whose max profit is at neither end — are
pinned by tests that run without a venue.

### Learn first

- `engine/src/deltapayoff/forward.py` — the shape of a pure module here: dataclass in,
  dataclass out, every assumption named in the result.
- `engine/tests/test_forward.py` — how a pure seam is driven, and how a refusal is pinned
  red-green.
- `docs/greeks.md` — the conventions the per-leg Greeks are summed under. Delta and gamma
  undiscounted; vega and rho discounted and per one percent; theta a **one-calendar-day**
  repricing on ACT/365. A 1/252 year overstates theta by 1.456x here.
- The sibling's `src/payoff/pricing.py` for structure. Its `TRADING_DAYS_PER_YEAR = 252` is
  the single thing in that repository that must not be copied.

### Task

A new pure module. Given the legs, their entry prices and their strikes:

1. **Corner points.** The kinks are the distinct strikes; add the window ends. Value each
   corner as the sum over legs of `direction * quantity * (intrinsic - entry_price)`.
2. **End slopes.** Below the lowest strike and above the highest, the line is straight —
   report the slope at each end so the browser can extend it as far as the reader zooms.
3. **Metrics.** Max profit, max loss (each `null` when unbounded), every breakeven, net
   premium paid or received, reward:risk.
4. **The window.** +/-3 standard deviations from the at-the-money implied volatility and the
   time to expiry, widened to include every strike carrying a leg.
5. **Totals.** Per-leg Greeks summed to a position Greek, each leg weighted by
   `direction * quantity`.
6. **The payoff table.** Rows at the corners and at a readable step between them.

### How you will know

- [ ] A long call: one corner at the strike, left slope 0, right slope +1, max loss the
      premium, max profit `null`, one breakeven at `strike + premium`.
- [ ] A short strangle: two corners, both end slopes non-zero, max profit finite, max loss
      `null`, two breakevens.
- [ ] A butterfly: three corners, both end slopes 0, both extremes finite.
- [ ] A breakeven that lands **exactly** on a strike is found once, not twice and not zero
      times.
- [ ] A strategy whose net premium is zero does not divide by zero in reward:risk.
- [ ] Each expected value in the tests comes from a worked example written by hand, never
      recomputed the way the code computes it.
- [ ] No import of `asyncio`, `datetime.now`, `httpx` or `pathlib` in the module.

### What to notice

Where the breakeven search is fragile. Between two corners the line is straight, so a
breakeven is one division — but two corners at the same P&L, or a segment that touches zero
without crossing, are the cases that produce a chart with a marker in the wrong place. Write
down which of them you found by thinking and which by a failing test.

### Blocked by

- #9


## Task 3 — P3 (#4): POST /analyse, live and stored

Part of the payoff feature. Spec: `docs/superpowers/specs/2026-09-10-payoff-design.md`.

### Concept

`POST /analyse`. The route that resolves each leg against real quotes, prices it with the
machinery that already exists, runs the pure core from #3, and returns the whole
analysis in one response.

Two read paths, both already built: the live chain cache when no minute is named, and
`historical.read_ladder_at` when one is.

### Why this way

The response is **deliberately fat** — curve, metrics, table, per-leg Greeks, total Greeks,
forward, discount, spot — for the sibling's reason. Splitting it means several round trips
carrying the same legs and recomputing the same curve, and the trader watches the numbers
arrive after the chart they belong to.

Nothing about the pricing is new. `compute.enrich` already fits the forward, inverts one
implied volatility per strike off the out-of-the-money leg's midpoint, and reports five
Greeks. This route composes; it does not compute.

**Entry price crosses the spread**: B enters at the ask, S at the bid. Not the mid, which is
a trade nobody can make — `measured`, the spread is a median 1.81% of the mid and 46.15% at
p90. Not `ltp`, which on this venue is the close of a rolling 24-hour candle. Not the mark,
which is Delta's own model output. See #1.

### Learn first

- `engine/src/deltapayoff/main.py` — the 13 existing routes, and how a route reaches the
  chain cache.
- `engine/src/deltapayoff/historical.py` — `read_ladder_at`, the stored-minute path.
- `engine/tests/test_historical.py` and `engine/tests/test_contract_bars.py` — the
  `TestClient` + `DELTA_LIVE_FEED=0` + `tmp_path` `BarStore` pattern. **No test touches the
  network**; `tests/conftest.py` makes one that tries fail loudly.
- `engine/src/deltapayoff/compute.py` — `enrich`, and what it needs to be handed.

### Task

1. Resolve every leg's canonical string with `Instrument.from_canonical`, then find it in the
   ladder for the chosen as-of.
2. Take the entry price from ask (buy) or bid (sell) when the request did not supply one.
3. Refuse, each with the status code and message the contract names:
   - legs spanning **more than one expiry** — 422, naming both series (#2)
   - an instrument not listed for that as-of — 404
   - a leg with **no quote on its side** and no `entry_price` supplied — 422, naming the leg
   - an empty leg list — 422
4. Compose forward, discount, per-strike implied volatility and Greeks from `compute.enrich`
   unchanged, run the pure core, and return the contract's response.
5. Every number per one unit of the underlying; `contract_value` echoed, never applied.

### How you will know

- [ ] A two-leg spread against the committed fixtures returns the response the contract
      describes, with `as_of` naming which minute it used.
- [ ] The same legs with a stored minute return that minute's numbers, and a different set
      from live.
- [ ] Each of the four refusals is pinned red-green, and the message names the offending part.
- [ ] A supplied `entry_price` overrides the quote; a leg with no quote and no supplied price
      fails the **whole** analysis rather than being dropped.
- [ ] `curl` against a running engine produces a readable analysis — paste it in the ticket.
- [ ] `ruff` clean, whole suite green, and `tests/test_no_delta_inputs.py` still passes.

### What to notice

How much of this route is composition and how much turned out to be new code. The claim in
the spec is "the new module is pure arithmetic over legs" — if the route needed real logic
of its own, say what it was, because that is a seam the design missed.

### Blocked by

- #3


## Task 4 — P4 (#5): Picking legs on the chain

Part of the payoff feature. Spec: `docs/superpowers/specs/2026-09-10-payoff-design.md`.

### Concept

A **B** and an **S** beside every call and put in the ladder. Clicking builds a strategy.
The strategy lives in the address bar, so the link a trader copies is the position.

A legs panel appears at the top of the chain's right-hand column when there is at least one
leg; the per-strike price chart from #46 sits underneath it, unchanged.

### Why this way

Because the ladder is where the reading already happens. A separate builder screen would mean
picking a strike twice — once to look at it, once to trade it — and the sibling project's
whole ergonomic advantage is that it does not.

State in the URL rather than in a store: a strategy is small, it is the thing a trader wants
to send someone, and a reload that loses four clicks is the kind of small betrayal that stops
a tool being used.

### Learn first

- `convex-hedge-payoff/web/components/ChainTable.tsx` — the `heldAt` / `aria-pressed` /
  "click a lit one to remove" pattern, worth taking almost verbatim.
- `convex-hedge-payoff/web/lib/legs-url.ts` and its test — the codec, and how a malformed leg
  is made to throw rather than be skipped.
- `web/components/ChainLadder.tsx` — what the buttons are going beside, and this project's
  theme. The **structure** is the sibling's; the **look** is this repo's.
- `web/AGENTS.md` — the Next.js rules. The web app computes nothing.

### Task

1. B and S beside each side of each strike. Lit when that leg is held, with `aria-pressed`.
2. Clicking a lit button removes one of that leg.
3. Encode the strategy into the URL and decode it back — the canonical instrument string,
   the direction, the quantity, and an entry price when one was typed. A malformed leg
   **throws**, naming the part that was wrong.
4. A legs panel at the top of the right-hand column, appearing only when a leg exists, with
   the #46 chart below it.
5. An **Analyse** button in the panel. Until #6 lands it may be rendered disabled — say so
   in the PR rather than wiring it to nothing.

### How you will know

- [ ] Clicking B, reloading the page, and finding the same leg still selected.
- [ ] Clicking a lit B removes exactly one, not the whole leg, when quantity is 2.
- [ ] The URL codec is tested pure in both directions, including that a malformed leg throws.
- [ ] A DOM fingerprint of the ladder before and after proves the two buttons per side moved
      nothing else.
- [ ] `bun run typecheck` and `bun run build` pass.
- [ ] No `parseFloat` anywhere in what you added.

### What to notice

How wide the ladder got. 65 strikes each gaining four buttons is a real change to a table
that already carries our IV and five Greeks per leg. If it stopped fitting, say so with a
screenshot — the fix is a design decision, not a CSS one.

### Blocked by

- #9


## Task 5 — P5 (#6): The analyse screen

Part of the payoff feature. Spec: `docs/superpowers/specs/2026-09-10-payoff-design.md`.

### Concept

The `/analyse` tab. Opened in a **new tab** from the chain so the ladder keeps streaming
behind it. The chart on top, three tabs beneath it — P&L, Greeks, Payoff Table — and the
metrics panel beside them.

The chart is drawn from the corner points, with the forward marked and every breakeven
marked. It zooms in **and out**, which is the whole reason the curve travels as corners.

### Why this way

The sibling samples 400 points across a fixed +/-6% window and therefore cannot zoom out past
it at all. A fixed percentage does not transfer: at 37% volatility, +/-6% is 1.6 sigma on a
3.8-day expiry and **0.33 sigma** at 86 days, where it would cut the interesting part of the
curve clean off. Corner points plus end slopes are exact and extend as far as the reader
drags.

**Units.** Every price on this venue is USD per one unit of the underlying, and
`contract_value` is 0.001 — so one contract of a 1,240-quoted call costs $1.24. The engine
sends per-underlying numbers and the screen multiplies. The toggle is **on by default**,
because dollars per contract is what leaves the account. It covers money **and** Greeks, with
the unit in the column header. A consequence worth stating on screen: with the toggle on, our
Greeks read 1,000x smaller than Delta's in the ladder beside them.

### Learn first

- `convex-hedge-payoff/web/lib/zoom.ts` — `Span`, `fullSpan`, `zoom`, `wheelFactor`, `contain`,
  `fit`. Its rule is "the window never leaves the data", which is exactly the constraint this
  ticket is lifting. Understand why it exists before replacing it.
- `convex-hedge-payoff/web/components/` — the tab structure and metrics panel to copy.
- `web/components/ScreenRail.tsx` and this repo's theme — the payoff screen gets **no rail
  entry**; it is reached from the chain.
- `docs/settlement.md` — the multiplier rule, so the toggle is applied at the very end.

### Task

1. Route and page at `/analyse`, reading the strategy from the URL.
2. Chart from the corner points: straight segments between corners, the end slopes extended
   to the window edges, the forward marked, each breakeven marked.
3. Zoom in and out, wheel and buttons, with a reset to the +/-3 sigma window the engine sent.
4. Metrics panel: max profit, max loss, breakevens, net premium, reward:risk — with
   "unlimited" rendered from `null` rather than from a large number.
5. Three tabs: **P&L** (the chart), **Greeks** (per-leg and total), **Payoff Table**.
6. The per-contract toggle, on by default, over money and Greeks, unit in the header.

### How you will know

- [ ] A short strangle drawn from four corners looks right at default zoom and still looks
      right zoomed out four times.
- [ ] Max profit `null` renders "unlimited", and no infinity ever reaches the DOM.
- [ ] Toggling units changes every money column and every Greek column, and the headers say
      which.
- [ ] The chart matches a hand-drawn expectation for a known butterfly — attach both.
- [ ] `bun run typecheck` and `bun run build` pass.
- [ ] The web app still calls `parseFloat` nowhere and computes no option maths.

### What to notice

Whether zoom-out is actually useful or merely possible. Zoom out far enough and every payoff
becomes two straight lines. If there is a sensible outer limit, propose one with the reason;
if there is not, say that too.

### Blocked by

- #4
- #5


## Task 6 — P6 (#7): Editing, and keeping up with the market

Part of the payoff feature. Spec: `docs/superpowers/specs/2026-09-10-payoff-design.md`.

### Concept

The analyse tab stops being a printout. A leg's contract, quantity and entry price are all
editable in place, and the tab keeps up with the market when the link is a live one.

### Why this way

"What if I were filled at 900" and "what if I did two of these" are the questions the screen
invites, and answering them by going back to the chain and re-clicking is the reason the
sibling's users keep a spreadsheet open beside it.

**Live when live, static when historical.** A link with no minute re-asks on a one-second
timer, so the forward marker, spot, the Greeks and the metrics stay current. A link naming a
minute never re-asks, because a stored minute is a fixed set of numbers and quietly turning
it live would be the same class of lie as forward-filling a bar.

The **curve itself does not move**. P&L at expiry depends on the strikes and what was paid,
neither of which changes. Only the marker and the numbers move.

The chain tab behind this one goes stale and nothing reconciles them. That is the accepted
cost of opening a separate tab, and it should be stated in the LLD rather than discovered.

### Learn first

- `web/lib/live.ts` — how this app already holds a live subscription and what it does on a gap.
- `docs/design/quiet-gap.md` — the measured worst quiet gap on a live socket is **6.792 s**
  (#59). A one-second poll that sees no change is normal, not an error.
- The URL codec from {{P4}} — editing rewrites the URL, and it must round-trip.

### Task

1. Edit a leg's quantity, entry price and contract in the tab.
2. Rewrite the URL **without reloading**, so the link stays copyable mid-drag.
3. Re-ask `POST /analyse` on a one-second timer when the URL names no minute; never when it
   does.
4. An **as-of chip** saying which it is — "live" with the time of the last response, or the
   stored minute.
5. Removing the last leg leaves a readable empty state, not a crash.

### How you will know

- [ ] Editing a quantity updates the metrics and the URL, and pasting that URL in a fresh tab
      reproduces the edit.
- [ ] A historical link never issues a second request — assert on the request count, not on a
      timer.
- [ ] A live link updates spot and the Greeks while the curve's corners stay put.
- [ ] No test reads the wall clock.
- [ ] `bun run typecheck` and `bun run build` pass.

### What to notice

What a one-second poll of a fat response actually costs. `/analyse` returns the curve, the
table and every Greek on every tick, and most of it is identical to the last one. Measure the
response size and the solve time, and if it is wasteful, say what the smaller request would
have to look like — do not build it here.

### Blocked by

- #6


## Task 7 — P7 (#8): The low-level design, and the numbers

Part of the payoff feature. Spec: `docs/superpowers/specs/2026-09-10-payoff-design.md`.

### Concept

The findings document. How the payoff feature is built inside, where it fails, what it costs,
and every number with the run that produced it.

### Why this way

**Measure rather than assert.** Every design decision in the spec carries a number that was
either measured on a fixture or assumed out loud, and half of them were arguments about
performance and size made without running anything. This ticket is where they stop being
arguments.

The LLD is also where the honest costs go on the record: the chain tab going stale behind the
analyse tab, the spread being crossed silently (#1), single-expiry only (#2). A cost written
down is a decision; a cost discovered later is a bug report.

### Learn first

- `docs/design/lld/` — the sixteen existing low-level designs, and the shape they share.
- `docs/storage.md` — a findings document that earned its length. Note how each figure names
  the run behind it.
- `CLAUDE.md` — "Tag every number `measured` or `assumed`, naming the request or run that
  produced it. Every source consulted on this project has given a good design and a bad
  number."

### Task

1. Write `docs/design/lld/payoff.md`: the modules and what each owns, the seams, the data
   flow from click to curve, and the failure modes with what the reader sees for each.
2. Measure and record, each tagged and each naming its run:
   - the **solve time** of one analysis, two-leg and six-leg
   - the **response size** in bytes, corner points versus a 400-point sampled curve
   - what a **one-second poll** costs over a minute
   - the **spread crossed** by a typical two-leg structure, in dollars per contract
3. Update `docs/design/hld.md`'s route list with `POST /analyse`.
4. Update the drift list in `CLAUDE.md` if this feature made anything else in it stale.
5. Keep it **under 200 lines**.

### How you will know

- [ ] Every number in the document carries `measured`, `assumed` or `derived` and names its run.
- [ ] The corner-point-versus-sampled comparison is a real measurement, not an estimate.
- [ ] The HLD's route list includes the new route.
- [ ] Under 200 lines.

### What to notice

Which of the spec's claims did not survive measurement. The spec asserts corner points are
"smaller on the wire" and that the fat response is worth the round trips it saves. If either
turns out not to be true at this scale, that is the most valuable line in the document.

### Blocked by

- #6
- #7

