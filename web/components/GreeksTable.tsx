import { formatIv, formatScaled, formatStrike } from "@/lib/format";
import { parseCanonical } from "@/lib/instrument";
import type { AnalysedLeg, Greeks } from "@/lib/payoff";

const NAMES: (keyof Greeks)[] = ["delta", "gamma", "vega", "theta", "rho"];

/**
 * One row per leg, in the order they were sent, and a total when there is one.
 *
 * **Nothing here signs or scales a Greek.** `docs/payoff-contract.md`: the per-leg rows
 * arrive already signed by `direction` and scaled by `quantity`, because that is what a
 * per-leg exposure means to whoever reads it beside the legs. Applying either again here
 * would square the quantity and flip the sign of every sold leg.
 *
 * **A leg with no volatility carries no Greeks**, and its cells are empty rather than
 * zero — `greeks` is `null` exactly when `iv` is. Five plausible numbers at some default
 * sigma would describe nothing, and a column of zeros is the same lie in a quieter font.
 *
 * **`total` is the engine's, published only when every leg solved**, and it is absent
 * rather than summed here: a total over the legs that happened to solve describes a
 * different position from the one on the screen, and nothing on the screen would say so.
 *
 * The conventions themselves are this project's, not the textbook's — delta and gamma
 * undiscounted and against the forward, vega and rho discounted and per one percent,
 * theta a **one-calendar-day** repricing because crypto trades weekends. The note under
 * the table says so where it is read.
 */
export default function GreeksTable({
  legs,
  total,
  factor,
  unit,
}: {
  legs: AnalysedLeg[];
  total: Greeks | null;
  /** `1`, or `contract_value` when the per-contract toggle is on. The exposures move
   * with the money, because a delta of 0.52 per underlying is 0.00052 per contract and
   * the two answer different questions. */
  factor: number;
  unit: string;
}) {
  return (
    <table className="grid greeks">
      <thead>
        <tr>
          <th>Leg</th>
          <th title="Implied volatility this leg's Greeks were computed at.">IV</th>
          <th title="Delta, with respect to the forward, undiscounted.">Δ ({unit})</th>
          <th title="Gamma, undiscounted.">Γ ({unit})</th>
          <th title="Vega, discounted, per one percent of volatility.">ν ({unit})</th>
          <th title="Theta, one calendar day on ACT/365 — crypto trades weekends.">
            Θ ({unit})
          </th>
          <th title="Rho, discounted, per one percent.">ρ ({unit})</th>
        </tr>
      </thead>
      <tbody>
        {legs.map((leg, index) => {
          // Every leg here came off the ladder's own buttons or a round-tripped URL,
          // both of which build the string with `canonicalInstrument`, so a parse
          // failure means the state is broken rather than that this row should hide it.
          const parsed = parseCanonical(leg.instrument);
          const label = parsed
            ? `${formatStrike(parsed.strike)} ${parsed.side === "call" ? "Call" : "Put"}`
            : leg.instrument;
          return (
            <tr key={`${leg.instrument}:${leg.direction}:${index}`}>
              <td>
                <span className={`leg-direction ${leg.direction === 1 ? "b" : "s"}`}>
                  {leg.direction === 1 ? "B" : "S"}
                </span>{" "}
                {leg.quantity}× {label}
              </td>
              <td className="num">{formatIv(leg.iv)}</td>
              {NAMES.map((name) => (
                <td key={name} className="num">
                  {formatScaled(leg.greeks === null ? null : leg.greeks[name] * factor)}
                </td>
              ))}
            </tr>
          );
        })}
        {total ? (
          <tr className="total">
            <td>Total</td>
            <td className="num" />
            {NAMES.map((name) => (
              <td key={name} className="num">
                {formatScaled(total[name] * factor)}
              </td>
            ))}
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}
