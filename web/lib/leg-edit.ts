/**
 * The four edits the analyse tab makes to a strategy, as pure functions of what was
 * typed.
 *
 * **Separate from `lib/legs.ts`, which is the chain's B/S buttons.** Those two take a
 * contract and a direction and know nothing about text; these take a character someone
 * is part way through typing and have to decide whether it means anything yet. One
 * module would have to answer both questions and would drag `looksCanonical` and the
 * half-typed-number rules onto the ladder, which has no use for either.
 *
 * **A rejected edit returns the array it was given, not an equal copy.** The screen
 * re-asks `POST /analyse` whenever the legs change identity, so a fresh array for a
 * half-typed `"1e"` would fire a request a keystroke for a strategy nobody changed.
 * Identity is the signal, and these functions are careful with it.
 *
 * **`Number`, never `parseFloat`.** The project's rule is about decimals arriving from
 * the engine, which are JSON numbers and are never parsed; a character a human typed
 * into a text field has to be read somehow. `Number` is what `lib/legs-url.ts` already
 * reads a `@price` fragment with, and it refuses `"1.2.3"` and `"12abc"` outright where
 * `parseFloat` would silently accept the good prefix and drop the rest — which on a
 * price is the difference between 1.2 and 1.23.
 */
import { looksCanonical } from "./instrument";
import type { LegRequest } from "./payoff";

/** The strategy with `index` replaced, or the same array when there is no such leg. */
function replace(
  legs: LegRequest[],
  index: number,
  edit: (leg: LegRequest) => LegRequest | null,
): LegRequest[] {
  const leg = legs[index];
  if (leg === undefined) return legs;
  const next = edit(leg);
  if (next === null) return legs;
  return legs.map((candidate, i) => (i === index ? next : candidate));
}

/**
 * "What if I did two of these."
 *
 * A positive integer, and nothing else — the contract's own words for `quantity`, and
 * the sign is never here: it lives in `direction`, which is why `"-1"` is refused rather
 * than being read as a sale.
 */
export function withQuantity(legs: LegRequest[], index: number, typed: string): LegRequest[] {
  return replace(legs, index, (leg) => {
    const quantity = Number(typed.trim());
    if (typed.trim() === "" || !Number.isInteger(quantity) || quantity < 1) return null;
    return { ...leg, quantity };
  });
}

/**
 * "What if I were filled at 900" — and the way back out of it.
 *
 * **An empty field deletes `entry_price` rather than setting it to zero.** Absent means
 * the engine prices the leg from the book by crossing the spread — buy at the ask, sell
 * at the bid — and a field with no way back to that would trap a leg at whatever was
 * last typed. `null` is not `0` here as everywhere else: a price of zero is a real zero
 * and is kept.
 *
 * A negative price is refused. An option is not sold for a negative premium; the credit
 * of a sale is `direction`, and reading a minus sign here as one would put the same fact
 * on the leg twice.
 */
export function withEntryPrice(legs: LegRequest[], index: number, typed: string): LegRequest[] {
  return replace(legs, index, (leg) => {
    if (typed.trim() === "") {
      if (leg.entry_price === undefined) return null;
      const { entry_price: _dropped, ...rest } = leg;
      return rest;
    }
    const entryPrice = Number(typed.trim());
    if (!Number.isFinite(entryPrice) || entryPrice < 0) return null;
    return { ...leg, entry_price: entryPrice };
  });
}

/**
 * A different contract, with the quantity and any typed price riding along — the edit
 * that turns "the 77,000 call" into "the 78,000 call" without rebuilding the leg.
 *
 * **`looksCanonical` gates it, exactly as in `lib/legs-url.ts`.** The engine's
 * `Instrument.from_canonical` remains the strict authority and answers 400 naming the
 * part that was wrong; this only keeps a half-typed string from being sent as a leg on
 * every keystroke.
 */
export function withInstrument(legs: LegRequest[], index: number, typed: string): LegRequest[] {
  return replace(legs, index, (leg) => {
    const instrument = typed.trim();
    if (!looksCanonical(instrument) || instrument === leg.instrument) return null;
    return { ...leg, instrument };
  });
}

/** The strategy without this leg. Removing the last one leaves `[]`, which is a screen
 *  state — "this link names no legs" — and never a request. */
export function removeLeg(legs: LegRequest[], index: number): LegRequest[] {
  if (legs[index] === undefined) return legs;
  return [...legs.slice(0, index), ...legs.slice(index + 1)];
}
