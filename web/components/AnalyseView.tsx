"use client";

import { useState } from "react";

import GreeksTable from "@/components/GreeksTable";
import MetricsPanel from "@/components/MetricsPanel";
import PayoffChart from "@/components/PayoffChart";
import PayoffTable from "@/components/PayoffTable";
import ThemeToggle from "@/components/ThemeToggle";
import { formatFetchedAt, formatSpot, formatStrike, unitFactor, unitLabel } from "@/lib/format";
import type { AnalyseResponse } from "@/lib/payoff";

const TABS = [
  { key: "pnl", label: "P&L" },
  { key: "greeks", label: "Greeks" },
  { key: "table", label: "Payoff Table" },
] as const;

type Tab = (typeof TABS)[number]["key"];

/**
 * The analyse screen, with the fetching taken out of it.
 *
 * `AnalyseScreen` holds the request and the state; this holds the picture. The split is
 * the one that makes the whole page assertable from `renderToStaticMarkup` without a
 * browser or a network — the seam `ladder-fingerprint.test.tsx` already established for
 * the ladder — and it costs nothing else, because everything below is a pure function of
 * four values.
 *
 * **A refusal replaces the analysis rather than sitting beside it.** The engine has
 * declined to answer for the strategy in this link, so there is no curve that belongs to
 * it; drawing one would be drawing some other strategy's. Both envelopes arrive here as
 * one already-flattened sentence — see `refusalDetail` in `lib/payoff.ts` for why there
 * are two, and `analyse.test.ts` for the proof that neither reaches this component as an
 * object.
 *
 * **The unit toggle lives here, and it is on.** Dollars per contract is what leaves the
 * account, so it is the default; it covers money **and** Greeks together, because a
 * screen with the money in one unit and the exposures in another is worse than either.
 * `unitFactor` and `unitLabel` are the whole of it, and the factor comes from the
 * response's own `contract_value`.
 */
export default function AnalyseView({
  analysis,
  problem,
  legsError,
  busy,
  legCount,
}: {
  analysis: AnalyseResponse | null;
  /** A refusal, or an unreachable engine, already flattened to one sentence. */
  problem: string | null;
  /** The `legs=` in the URL could not be read — `LegsUrlError`'s own message, naming
   * the fragment and the part of it that was wrong. Never treated as "no strategy". */
  legsError: string | null;
  busy: boolean;
  /** How many legs the link named, which is knowable even when nothing has answered. */
  legCount: number;
}) {
  const [tab, setTab] = useState<Tab>("pnl");
  const [perContract, setPerContract] = useState(true);

  const factor = analysis === null ? 1 : unitFactor(perContract, analysis.contract_value);
  const unit = unitLabel(perContract);

  /* How much smaller a per-contract Greek reads than the ladder's own. Derived from the
     response rather than written down as 1,000: `contract_value` is 0.001 on BTC and
     0.01 on ETH, and a sentence that said "1,000x" on an ETH strategy would be wrong by
     a factor of ten in the one place a reader is being warned about a factor. */
  const smallerBy =
    analysis !== null && analysis.contract_value > 0 ? 1 / analysis.contract_value : null;

  return (
    <div className="shell">
      <header className="header">
        <div className="brand">DELTA</div>
        <div className="stat lead">
          <span className="stat-label">Strategy</span>
          <span className="stat-value">
            {legCount} {legCount === 1 ? "leg" : "legs"}
          </span>
        </div>

        {analysis ? (
          <>
            <span className="chip">{analysis.underlying}</span>
            <span className="chip">{analysis.expiry}</span>
            <span className="chip" title="The minute this analysis was priced against.">
              as of {formatFetchedAt(analysis.as_of)}
            </span>
            <div className="stat">
              <span className="stat-label">Spot</span>
              <span className="stat-value">{formatSpot(analysis.spot)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Forward</span>
              <span className="stat-value">{formatSpot(analysis.forward)}</span>
            </div>
          </>
        ) : null}

        <label className="unit-toggle" title="Dollars per contract, or per one unit of the underlying.">
          <input
            type="checkbox"
            checked={perContract}
            onChange={(event) => setPerContract(event.target.checked)}
          />
          <span>Per contract</span>
        </label>

        <ThemeToggle />
      </header>

      <main className="main">
        {legsError ? (
          <p className="notice error">
            The strategy link could not be read: {legsError}. Nothing was analysed rather
            than guessing which legs were meant.
          </p>
        ) : null}

        {problem ? <p className="notice error">{problem}</p> : null}

        {legCount === 0 && legsError === null ? (
          <p className="notice">
            This link names no legs. Build a strategy on the chain — the B and S beside
            every strike — and press Analyse. An empty strategy is a flat line at zero.
          </p>
        ) : null}

        {analysis === null ? (
          busy ? <p className="notice">Analysing…</p> : null
        ) : (
          <div className="analyse-body">
            <div className="analyse-main">
              <PayoffChart
                curve={analysis.curve}
                forward={analysis.forward}
                breakevens={analysis.metrics.breakevens}
                factor={factor}
                unit={unit}
              />

              <div className="tabs" role="tablist">
                {TABS.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    role="tab"
                    className="tab"
                    aria-selected={tab === entry.key}
                    onClick={() => setTab(entry.key)}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>

              {tab === "pnl" ? (
                <p className="note">
                  P&amp;L at expiry, drawn from the corner points the engine sent and the
                  two end slopes outside them — exact at every price, which is why this
                  chart zooms out as far as you drag it. The forward is marked, and so is
                  every breakeven inside the window. The line does not move: it depends on
                  the strikes and what was paid, and neither of those changes.
                </p>
              ) : null}

              {tab === "greeks" ? (
                <>
                  <GreeksTable
                    legs={analysis.legs}
                    total={analysis.total_greeks}
                    factor={factor}
                    unit={unit}
                  />
                  <p className="note">
                    Each row is signed by its direction and scaled by its quantity. Δ and Γ
                    are undiscounted and with respect to the forward; ν and ρ are
                    discounted and per one percent; Θ is a <strong>one calendar day</strong>{" "}
                    repricing, because crypto trades weekends. A leg with no volatility
                    carries no Greeks, and the total is published only when every leg does.
                  </p>
                </>
              ) : null}

              {tab === "table" ? (
                <PayoffTable
                  table={analysis.table}
                  forward={analysis.forward}
                  factor={factor}
                  unit={unit}
                />
              ) : null}
            </div>

            <aside className="analyse-side">
              <MetricsPanel metrics={analysis.metrics} factor={factor} unit={unit} />
              <p className="note">
                Priced against forward {formatSpot(analysis.forward)}, discount{" "}
                {analysis.discount === null ? "—" : analysis.discount.toFixed(6)}, spot{" "}
                {formatSpot(analysis.spot)}. Every figure on this page came from one
                request, so none of them can be as of a different minute.
                {perContract && smallerBy !== null ? (
                  <>
                    {" "}
                    Money <strong>and Greeks</strong> are multiplied by the lot size{" "}
                    {analysis.contract_value}, so the exposures here read{" "}
                    <strong>{formatStrike(smallerBy)}×</strong> smaller than Delta&rsquo;s
                    own in the ladder behind this tab. The prices on the horizontal axis
                    and the breakevens are not multiplied: they are prices of the
                    underlying, not amounts.
                  </>
                ) : null}
              </p>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
