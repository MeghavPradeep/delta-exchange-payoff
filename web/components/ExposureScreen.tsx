"use client";

import { useEffect, useState } from "react";

import StrikeBars from "@/components/StrikeBars";
import ThemeToggle from "@/components/ThemeToggle";
import { UNDERLYINGS, type ChainResponse, type Underlying } from "@/lib/contract";
import { ENGINE_URL, loadExpiries } from "@/lib/engine";
import { zeroCrossStrike, type StrikeBar } from "@/lib/exposure";
import { formatFetchedClock, formatSpot } from "@/lib/format";
import { LIVE_STATUS_LABEL, subscribeChain, type LiveStatus } from "@/lib/live";
import type { ViewRequest } from "@/lib/view";

/**
 * The shell both exposure screens wear: two pickers, a live ladder behind them, and one
 * chart.
 *
 * **One shell, two screens.** GEX and OI ask the engine the same question — the live
 * chain for one underlying and one expiry — and differ only in what they make of the
 * answer. The projection arrives as a prop, so the fetching, the pickers, the socket, the
 * status chips and the empty states exist once. `VolatilityScreen` is the precedent for
 * what lives in a screen (state and layout) and what does not (arithmetic, which is
 * `lib/exposure.ts`).
 *
 * **Live only, and there is no scrubber.** Both boards are read for where the market is
 * standing right now; the stored day would need an engine route that joins gamma from
 * table C to open interest from table B, which is a separate ticket and not needed to see
 * the shape. The socket is the same `/ws/chain` the ladder and the smile's right edge
 * already share — a second browser tab costs a queue, not a connection.
 *
 * **A projection may refuse the whole board**, and that is the state this shell is most
 * careful about. GEX in dollars needs `spot` and `contract_value`; without either, the
 * axis would be in units nobody could name, so `lib/exposure.ts` returns `null` and the
 * shell says which multiplier is missing instead of drawing an unlabelled chart. This is
 * the same rule as a leg with no volatility carrying no Greeks.
 *
 * **The URL carries the underlying and the expiry** so a link means one board. There is
 * no minute to carry — nothing here is pinned to one — so `viewQuery` is not reused: it
 * always writes a minute, and a minute in this address would promise a fixed board the
 * screen does not have.
 */
export default function ExposureScreen({
  initial,
  title,
  /** What the chart is of, in the platform's own words — "Gamma exposure". */
  heading,
  /** Turns a live chain into bars, or refuses it. */
  project,
  /** Why a refusal happened, in one sentence, given the chain that was refused. */
  refusal,
  axisTitle,
  format,
  note,
  /** The coverage line, or `null` when the projection has nothing to qualify. */
  coverage,
  showCumulative,
}: {
  initial: ViewRequest;
  title: string;
  heading: string;
  project: (chain: ChainResponse) => StrikeBar[] | null;
  refusal: (chain: ChainResponse) => string;
  axisTitle: string;
  format: (value: number | null) => string;
  note: React.ReactNode;
  coverage?: (chain: ChainResponse) => string | null;
  showCumulative?: boolean;
}) {
  const [underlying, setUnderlying] = useState<Underlying>(initial.underlying ?? "BTC");
  const [expiries, setExpiries] = useState<string[]>([]);
  const [expiry, setExpiry] = useState<string>(initial.expiry ?? "");
  const [chain, setChain] = useState<ChainResponse | null>(null);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [detail, setDetail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /*
   * The expiry list, and the choice it constrains.
   *
   * `useSmileDay`'s rule, kept: a URL naming an expiry the engine does not list has to be
   * resolved against the list before anything is subscribed, or the dropdown shows one
   * expiry while the chart draws another. The engine's own preferred expiry wins when the
   * link named one that is not listed.
   */
  useEffect(() => {
    let live = true;
    loadExpiries(underlying)
      .then(({ data, preferredExpiry }) => {
        if (!live) return;
        setExpiries(data.expiries);
        setError(null);
        setExpiry((current) => {
          if (current && data.expiries.includes(current)) return current;
          if (preferredExpiry && data.expiries.includes(preferredExpiry)) return preferredExpiry;
          return data.expiries[0] ?? "";
        });
      })
      .catch((err: unknown) => {
        if (!live) return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      live = false;
    };
  }, [underlying]);

  /* The board itself. Cleared on a series change rather than left up: a chart drawn for
     one expiry and labelled with another is this feature's characteristic failure. */
  useEffect(() => {
    if (!expiry) return;
    setChain(null);
    return subscribeChain(underlying, expiry, {
      onChain: setChain,
      onStatus: (next, why) => {
        setStatus(next);
        setDetail(why ?? null);
      },
    });
  }, [underlying, expiry]);

  // The address bar follows the pickers. `replaceState` rather than a router push, for
  // the reason every screen here gives: changing an expiry must not fill the back button.
  useEffect(() => {
    const params = new URLSearchParams({ underlying });
    if (expiry) params.set("expiry", expiry);
    const href = `${window.location.pathname}?${params.toString()}`;
    if (`${window.location.pathname}${window.location.search}` !== href) {
      window.history.replaceState(null, "", href);
    }
  }, [underlying, expiry]);

  const bars = chain ? project(chain) : null;
  const coverageLine = chain && coverage ? coverage(chain) : null;

  return (
    // No `.app` wrapper and no rail: `app/layout.tsx` owns both, so navigating between
    // screens does not tear down the chain websocket.
    <main className="screen">
        <header className="header">
          <div className="brand">DELTA</div>
          <h1 className="screen-title">{title}</h1>

          <label className="picker">
            <span className="stat-label">Underlying</span>
            <select
              className="picker-select"
              value={underlying}
              onChange={(e) => setUnderlying(e.target.value as Underlying)}
            >
              {UNDERLYINGS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>

          <label className="picker">
            <span className="stat-label">Expiry</span>
            <select
              className="picker-select"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              disabled={expiries.length === 0}
            >
              {expiries.length === 0 ? <option value="">—</option> : null}
              {expiries.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>

          <div className="stat lead">
            <span className="stat-label">Spot</span>
            <span className="stat-value">{formatSpot(chain?.spot ?? null)}</span>
          </div>

          <div className="stat">
            <span className="stat-label">As of</span>
            <span className="stat-value">
              {chain ? formatFetchedClock(chain.fetched_at) : "—"}{" "}
              <span className="stat-note">UTC</span>
            </span>
          </div>

          <span
            className="chip"
            title={detail ?? `Streaming from ${ENGINE_URL}/ws/chain.`}
          >
            {LIVE_STATUS_LABEL[status]}
          </span>

          <ThemeToggle />
        </header>

        <h2 className="exposure-heading">
          {heading}
          {coverageLine ? <span className="exposure-coverage">{coverageLine}</span> : null}
        </h2>

        {error ? <p className="notice error">{error}</p> : null}

        {chain === null ? (
          <p className="notice">
            {status === "error"
              ? (detail ?? "The engine could not be reached.")
              : "Connecting to the engine…"}
          </p>
        ) : bars === null ? (
          // A refusal, not an empty chart. The projection could not be made in the units
          // the axis claims, and saying which multiplier is missing is the whole answer.
          <p className="notice">{refusal(chain)}</p>
        ) : (
          <StrikeBars
            bars={bars}
            spot={chain.spot}
            atmStrike={chain.atm_strike}
            zeroCross={showCumulative ? zeroCrossStrike(bars) : null}
            axisTitle={axisTitle}
            format={format}
            showCumulative={showCumulative}
          />
        )}

      <p className="note">{note}</p>
    </main>
  );
}
