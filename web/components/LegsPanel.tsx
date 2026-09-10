"use client";

import { formatStrike } from "@/lib/format";
import { parseCanonical } from "@/lib/instrument";
import type { LegRequest } from "@/lib/payoff";

/**
 * P4: the strategy built off the ladder, read out as a list, with the one button that
 * leaves this ticket for #6.
 *
 * **Read-only.** The ticket's own mechanism for changing a leg is the ladder's B/S
 * buttons — "clicking a lit button removes one of that leg" — and this panel is where
 * the result of that is seen, not a second place to edit it. The spec's own words for
 * the analyse tab (P6) are "fully editable — contract, quantity, entry price"; giving
 * this panel its own quantity box and its own remove control would be building half of
 * that early, in the one place the spec says editing does *not* live.
 *
 * **Rendered only when there is at least one leg** — the caller (`ChainScreen`) does
 * not mount this component otherwise, so there is no empty state to design here.
 */
export default function LegsPanel({ legs }: { legs: LegRequest[] }) {
  return (
    <section className="legs-panel" aria-label="Strategy">
      <h2 className="legs-panel-title">
        Legs — {legs.length} {legs.length === 1 ? "leg" : "legs"}
      </h2>

      <ul className="legs-list">
        {legs.map((leg, index) => {
          // Every leg here came off the ladder's own buttons or a round-tripped URL —
          // both build the string with `canonicalInstrument` — so a parse failure
          // would mean the state itself is broken, not that this row should hide it.
          const parsed = parseCanonical(leg.instrument);
          const label = parsed
            ? `${formatStrike(parsed.strike)} ${parsed.side === "call" ? "Call" : "Put"}`
            : leg.instrument;
          return (
            <li key={`${leg.instrument}:${leg.direction}:${index}`} className="leg-row">
              <span className={`leg-direction ${leg.direction === 1 ? "b" : "s"}`}>
                {leg.direction === 1 ? "B" : "S"}
              </span>
              <span className="leg-quantity">{leg.quantity}×</span>
              <span className="leg-label">{label}</span>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="analyse"
        disabled
        title="Not wired yet — the analyse screen this opens is a later ticket (#6)."
      >
        Analyse {legs.length} {legs.length === 1 ? "leg" : "legs"}
      </button>
    </section>
  );
}
