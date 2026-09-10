"use client";

import { removeLeg, withEntryPrice, withInstrument, withQuantity } from "@/lib/leg-edit";
import type { LegRequest } from "@/lib/payoff";

/**
 * P6: the strategy, editable in place — contract, quantity and entry price.
 *
 * This is the panel `LegsPanel` on the chain screen deliberately is not. Its own header
 * comment says why: the ladder's B/S buttons are that screen's way of changing a leg,
 * and "fully editable — contract, quantity, entry price" is the analyse tab's job. This
 * is that job, and the two panels stay apart rather than one growing a `readOnly` flag.
 *
 * **Editing the entry price is what makes an unquoted leg recoverable.** A leg with
 * nothing on its side and no `entry_price` refuses the whole analysis
 * (`docs/payoff-contract.md` §Refusals, last row) — "a leg nobody is quoting is not
 * disabled, it is asked about" — so this panel is rendered whether or not there is an
 * analysis beside it. A refusal that replaced these inputs would put the question on
 * screen and take away the only way to answer it.
 *
 * **The inputs are uncontrolled, and that is deliberate.** A controlled field whose
 * value is the leg cannot be typed into: `withEntryPrice` reads `"0."` as `0` and would
 * re-render the box as `0`, eating the decimal point on the way to `0.5`, and a cleared
 * quantity box would snap straight back to what it held. The DOM keeps the text, this
 * component keeps only the legs, and `key` — instrument, direction and position — is
 * what re-seeds a row when the leg under it genuinely changes, which is exactly when a
 * leg is removed and the rows below it shift up.
 *
 * **Quantity commits as you type; the contract and the price commit on leaving the
 * field or on Enter.** Every commit re-asks `POST /analyse`, and a half-typed strike is
 * a different contract while a half-typed price is a different price — `9`, `90`, `900`
 * would each be sent and two of them are fills nobody got. A quantity has no meaningful
 * half-typed state: every prefix of an integer is an integer.
 *
 * **`direction` is not editable here.** The ticket names three fields and this is the
 * fourth; B and S are separate positions rather than one signed quantity, and a toggle
 * that turned a bought leg into a sold one at the same entry price would quietly claim a
 * fill on the other side of the spread.
 */
export default function LegEditor({
  legs,
  onLegsChange,
}: {
  legs: LegRequest[];
  onLegsChange: (legs: LegRequest[]) => void;
}) {
  return (
    <section className="legs-panel leg-editor" aria-label="Strategy">
      <h2 className="legs-panel-title">
        Legs — {legs.length} {legs.length === 1 ? "leg" : "legs"}
      </h2>

      <ul className="legs-list">
        {legs.map((leg, index) => (
          <li
            key={`${leg.instrument}:${leg.direction}:${index}`}
            className="leg-row leg-edit-row"
          >
            <span className={`leg-direction ${leg.direction === 1 ? "b" : "s"}`}>
              {leg.direction === 1 ? "B" : "S"}
            </span>

            <input
              className="leg-input leg-contract"
              aria-label="Contract"
              title="The canonical instrument string. The engine is the authority on it and names the part that was wrong."
              defaultValue={leg.instrument}
              spellCheck={false}
              onBlur={(event) => onLegsChange(withInstrument(legs, index, event.target.value))}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />

            <input
              className="leg-input leg-qty"
              aria-label="Quantity"
              title="How many of this contract. A positive integer; the sign is the B or S beside it."
              type="number"
              min={1}
              step={1}
              defaultValue={leg.quantity}
              onChange={(event) => onLegsChange(withQuantity(legs, index, event.target.value))}
            />

            <input
              className="leg-input leg-price"
              aria-label="Entry price"
              title="What you were filled at, USD per one unit of the underlying. Leave it empty and the engine crosses the spread — buy at the ask, sell at the bid."
              type="text"
              inputMode="decimal"
              placeholder="from the book"
              defaultValue={leg.entry_price ?? ""}
              onBlur={(event) => onLegsChange(withEntryPrice(legs, index, event.target.value))}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />

            <button
              type="button"
              className="leg-remove"
              aria-label="Remove leg"
              title="Remove this leg from the strategy"
              onClick={() => onLegsChange(removeLeg(legs, index))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <p className="leg-editor-note">
        An empty price is filled from the book by crossing the spread. Everything you
        change here is written into the address bar, so the link stays the strategy on
        screen.
      </p>
    </section>
  );
}
