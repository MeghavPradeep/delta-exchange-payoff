# The payoff screen: pick legs off the chain, see what the position does

Decided 2026-09-10 in a design interview. Terms are `docs/chain-contract.md`'s and
`docs/design/events.md`'s. Where this file and an issue disagree, the issue wins.

The sibling project [`convex-hedge-payoff`](https://github.com/lalitkarthik/convex-hedge-payoff)
does this for NIFTY and is the reference for the **shape**. It is not the reference for the
maths: its clock is a 252-trading-day year, and `docs/greeks.md` measured that as **1.456x**
wrong here because crypto trades weekends. Delta's own ACT/365 core is what prices this.

---

## Problem Statement

The chain screen is read-only. A trader can see 65 strikes, our implied volatility and our
five Greeks per leg, and can do nothing with them: there is no way to say "buy this call,
sell that one" and find out what the pair does. Every number needed to answer that is
already computed once a second and thrown away — the forward, the discount, one implied
volatility per strike, and the Greeks under both — and the only thing missing is a list of
legs and the arithmetic that turns them into a curve.

The sibling platform has that screen and this one does not, so the two halves of the same
desk read different products.

## Solution

Two additions, one on each side.

**On the engine**, one new route. `POST /analyse` takes an ordered list of legs — each one a
canonical instrument string, a direction, a quantity and an optional entry price — and
returns everything about that strategy in a single response: the payoff curve, the four
metrics, the per-leg and total Greeks, the payoff table, and the forward, discount and spot
it was all priced against. It is **deliberately fat**, for the sibling's reason: splitting it
would mean several round trips carrying the same legs and recomputing the same curve, and the
trader would watch the numbers arrive after the chart they belong to.

Nothing about the pricing is new. `compute.enrich` already fits the forward, inverts one
implied volatility per strike off the out-of-the-money leg's midpoint, and reports five
Greeks under `greeks.py`'s conventions. The new module is pure arithmetic over legs.

**On the screen**, a **B** and an **S** beside every call and put. Clicking builds a strategy,
which lives in the address bar. A legs panel appears at the top of the chain's right-hand
column when there is at least one leg; the per-strike price chart from #46 sits underneath
it, unchanged. Pressing Analyse opens a **new tab** at `/analyse`, which draws the payoff.

## User Stories

1. As a trader, I want a B and an S beside every option, so that I can build a position from the ladder I am already reading.
2. As a trader, I want a button already in my position to be lit, so that a strike I hold does not look like one I do not.
3. As a trader, I want clicking a lit button to take one back off, so that the button that put a leg there removes it.
4. As a trader, I want my strategy in the address bar, so that the link I copy is the position.
5. As a trader, I want the analysis in a new tab, so that the chain keeps streaming behind it.
6. As a trader, I want the payoff at expiry drawn against the forward, so that the axis is the price the market actually implies.
7. As a trader, I want to zoom the chart out, so that a wide structure fits on screen.
8. As a trader, I want max profit, max loss, breakevens and net premium under the chart, so that I can read the trade without measuring the picture.
9. As a trader, I want per-leg and total Greeks, so that I know what the position is exposed to.
10. As a trader, I want a payoff table, so that I can read exact figures rather than infer them.
11. As a trader, I want figures in dollars per contract by default, so that the numbers are what leaves my account.
12. As a trader, I want to flip back to per-underlying figures, so that they can be compared against the ladder beside them.
13. As a trader, I want to change a leg's quantity, entry price or contract in the analyse tab, so that "what if" questions do not send me back to the chain.
14. As a trader, I want the tab to keep up with the market when it is live, so that the Greeks and the forward are current.
15. As a trader, I want a tab opened from a past minute to stay at that minute, so that a historical reading does not silently become a live one.
16. As a trader, I want a leg nobody is quoting to ask me for a price, so that no price is invented on my behalf.
17. As a developer, I want the payoff core pure, so that it is tested without a socket, a clock or a file.
18. As a developer, I want the contract written before the models, so that both halves are built against one document.

## Implementation Decisions

**The as-of.** `/analyse` serves the **live** chain by default and a **stored minute** when
one is named, reusing the two read paths that already exist — the chain cache for live, and
`historical.read_ladder_at` for a minute. One optional parameter, two paths already built.

**A leg is named by its canonical instrument string** — `DELTA-BTC-20260904-77000-C-USD`.
`/bars` set that precedent in #46 and gave the reason: the panel opens from a strike the
reader clicked, so the one string the URL already carries is the one the request is made
with. `Instrument.from_canonical` is then the single validator, and a malformed leg fails at
the boundary naming the part that was wrong.

**Entry price crosses the spread.** B enters at the **ask**, S at the **bid**. Not the mid,
which is a trade nobody can make — `measured` on `tickers-btc-04-09-2026.json`, the spread is
a **median 1.81%** of the mid, **46.15%** at p90 and **116.67%** at its worst. Not the last
traded price, which on this venue is the close of the venue's rolling 24-hour candle
republished on every frame. Not the mark, which is Delta's own model output. The choice and
what it hides are [#1](https://github.com/MeghavPradeep/delta-exchange-payoff/issues/1).

**A leg with no quote on its side gets no entry price**, and the whole analysis is refused
until one is typed. Not disabled — "what if I were filled at 900" is exactly the question an
unquoted wing invites — and never inferred from the other side.

**One expiry per strategy.** Legs spanning two are refused with a 422 naming both. With two
expiries there is no date on which every leg has finished, so the surviving leg has a price
rather than a payoff and the line can only be drawn by assuming a volatility. Calendar and
diagonal spreads are [#2](https://github.com/MeghavPradeep/delta-exchange-payoff/issues/2).

**The curve travels as its corner points, not as samples.** A single-expiry payoff is
piecewise linear — straight everywhere, kinked only at a strike — so the engine sends the
kinks plus the two end slopes and the browser draws straight segments between them. That is
**exact** rather than sampled, smaller on the wire, and it is what makes zooming out free:
the sibling samples 400 points across a fixed window and therefore cannot zoom out past it at
all. Drawing a line between two given points is rendering, not arithmetic, so `web/`'s rule
that it computes nothing is intact.

**The window opens at ±3 standard deviations**, from the at-the-money implied volatility and
the time to expiry, widened to include every strike carrying a leg. A fixed percentage does
not transfer from NIFTY: at 37% volatility ±6% is 1.6 sigma on a 3.8-day expiry and **0.33
sigma** at 86 days, where it would cut off the whole interesting part of the curve.

**Units: the engine sends what it computes, the screen multiplies.** Every price on this venue
is USD per one unit of the underlying and `contract_value` is 0.001, so one contract of a
1,240-quoted call costs $1.24. `docs/settlement.md` is explicit that the multiplier never
enters a pricing calculation and is applied at the very end. So the response is per-underlying
and the screen carries a toggle, **on by default**, showing dollars per contract — money and
Greeks together, with the unit in the column header. A consequence worth stating: with the
toggle on, our Greeks read 1,000x smaller than Delta's own in the ladder beside them.

**One line, and it does not move.** P&L at expiry only. It depends on the strikes and what was
paid, neither of which changes, so a live tab moves the forward marker, spot, the Greeks and
the metrics while the curve sits still. A second "value today" line is genuinely curved, would
have to be sampled, and would forfeit the corner-point decision above; it is not built.

**Live when live, static when historical.** A link with no minute re-asks on a one-second
timer. A link naming a minute never re-asks, because a stored minute is a fixed set of numbers.

**The analyse tab is fully editable** — contract, quantity, entry price — and rewrites the URL
without reloading, so the link stays copyable mid-drag. The chain tab behind it goes stale and
nothing reconciles them; that is the accepted cost of a separate tab.

**No presets.** Anything a preset builds, four clicks build. The sibling's strike-width
heuristic assumes NIFTY's uniform 50-point grid, and BTC's is `measured` at 100–200 near the
money, 500 through the belly and 1,000 in the wings, so the rule would need designing rather
than porting.

**No rail entry.** The payoff is reached from the chain, not from the left-hand strip.

**Nothing is stored.** A payoff is a view over data already recorded; it writes no table and
publishes no event.

## Testing Decisions

A good test drives a seam and observes what crosses it. Four seams, three already here.

- **The pure payoff core.** The primary seam: legs in, corners and metrics out, no I/O. Where
  unbounded-versus-finite, the kink at every strike, and a breakeven that lands exactly on a
  strike are pinned. Prior art: `test_forward.py`, `test_bars.py`.
- **The route under `TestClient`** with `DELTA_LIVE_FEED=0`, against the committed fixtures and
  a `BarStore` on a `tmp_path` — the pattern `test_historical.py` and `test_contract_bars.py`
  already use for the other two read paths.
- **The URL codec**, pure both ways, including that a malformed leg throws rather than being
  skipped. Prior art: the sibling's own `legs-url.test.ts`.
- **The chain contract fixtures.** A DOM fingerprint of the ladder before and after, so adding
  two buttons per side is proved not to have moved anything else.

Every refusal is verified red-green: mixed expiry, an unlisted instrument, a leg with no
entry price. No test touches the network; no test reads the wall clock.

## Out of Scope

Presets. Calendar and diagonal spreads (#2). A value-today line and a target-date slider. A
rail entry. Order execution — nothing here places a trade, and the word "position" is
deliberately not used for a strategy being analysed. Depth beyond the top of book, and any
fill or slippage model (#1). Storing strategies server-side. Multi-underlying strategies.

## Further Notes

Ticket order, one at a time. The frontier is any ticket whose blockers are closed. Every
number carries `measured`, `assumed` or `derived` and the run behind it. Commits carry the
repository owner's name only.

## Tickets

| # | Key | Title | Blocked by |
|---|---|---|---|
| | P1 | The payoff contract | — |
| | P2 | The pure payoff core | P1 |
| | P3 | `POST /analyse`, live and stored | P2 |
| | P4 | Picking legs on the chain | P1 |
| | P5 | The analyse screen | P3, P4 |
| | P6 | Editing, and keeping up with the market | P5 |
| | P7 | The low-level design, and the numbers | P5, P6 |
