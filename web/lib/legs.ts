/**
 * Which contracts the ladder's B/S buttons should already be showing as held, and the
 * two edits those buttons make.
 *
 * The strategy has been sitting in the URL the whole time and the ladder rendered none
 * of it onto the table, so a strike already in the position looked exactly like one
 * that was not. These three functions are the whole of that: the buttons in
 * `ChainLadder.tsx` just read and call them.
 *
 * **A leg is identified by its instrument and its direction, and nothing else.** Unlike
 * the sibling project's `strike`/`optionType`/`expiry` triple, this project's leg
 * already carries the whole contract as one canonical string (`docs/payoff-contract.md`),
 * so there is no second key to keep in step with it. Bought and sold are different
 * positions, not one position with a sign — `CONTEXT.md`'s separation of `direction`
 * from `quantity` — so B and S light independently and never both.
 */
import type { Direction, LegRequest } from "./payoff";

function matches(leg: LegRequest, instrument: string, direction: Direction): boolean {
  return leg.instrument === instrument && leg.direction === direction;
}

/** Whether this exact contract, traded this way, is anywhere in the strategy. */
export function heldAt(legs: LegRequest[], instrument: string, direction: Direction): boolean {
  return legs.some((leg) => matches(leg, instrument, direction));
}

/**
 * The strategy with one new one-lot leg appended.
 *
 * No `entry_price`. Left absent rather than captured from the ladder at click time so
 * the engine fills it at analysis time by crossing the spread — `docs/payoff-contract.md`:
 * buy at the ask, sell at the bid — which is the true price of a fill happening now
 * rather than the fleeting quote under the pointer.
 */
export function addLeg(legs: LegRequest[], instrument: string, direction: Direction): LegRequest[] {
  return [...legs, { instrument, direction, quantity: 1 }];
}

/**
 * The strategy with **one** matching leg removed.
 *
 * One, not all of them. Clicking B twice on the same strike builds two one-lot legs —
 * `addLeg` never merges into an existing leg's quantity — so a click on the lit button
 * has to take one back off and leave the button lit; the alternative undoes a click the
 * trader never made.
 */
export function dropFirst(
  legs: LegRequest[],
  instrument: string,
  direction: Direction,
): LegRequest[] {
  const at = legs.findIndex((leg) => matches(leg, instrument, direction));
  return at === -1 ? legs : [...legs.slice(0, at), ...legs.slice(at + 1)];
}
