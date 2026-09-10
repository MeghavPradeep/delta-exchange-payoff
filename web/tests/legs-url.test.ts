/**
 * `lib/legs-url.ts` — the Strategy's URL codec, pure in both directions.
 *
 * Two properties matter more than the spelling of the format. A leg that survives a
 * copy-paste into a fresh tab is the whole feature (P4's "reload and find the same leg
 * still selected"); and a malformed link must fail loudly, because the alternative is
 * dropping a leg silently and showing a trader a chart of a position they did not build.
 *
 * **The seam is the pure one**, following `payoff.test.ts`'s and `moneyness.test.ts`'s
 * precedent: no DOM, no fetch, no engine, `node:assert/strict` plus this repo's own
 * `check()` harness. `bun run test`.
 */
import assert from "node:assert/strict";

import type { LegRequest } from "@/lib/payoff";
import { LegsUrlError, decodeLegs, encodeLegs } from "@/lib/legs-url";

let failures = 0;

function check(name: string, body: () => void): void {
  try {
    body();
    console.log(`  ok    ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log("legs-url / encodeLegs, decodeLegs — the Strategy's URL codec");

const CALL = "DELTA-BTC-20260904-77000-C-USD";
const PUT = "DELTA-BTC-20260904-76000-P-USD";

check("a single bought leg, quantity 1, no entry price, survives the round trip", () => {
  const legs: LegRequest[] = [{ instrument: CALL, direction: 1, quantity: 1 }];
  assert.deepEqual(decodeLegs(encodeLegs(legs)), legs);
});

check("a sold leg with quantity and an entry price survives the round trip", () => {
  const legs: LegRequest[] = [{ instrument: PUT, direction: -1, quantity: 2, entry_price: 326.7 }];
  assert.deepEqual(decodeLegs(encodeLegs(legs)), legs);
});

check("two legs survive, in order — the order the Greeks table is read in", () => {
  const legs: LegRequest[] = [
    { instrument: CALL, direction: 1, quantity: 1, entry_price: 1240.0 },
    { instrument: PUT, direction: -1, quantity: 1, entry_price: 326.7 },
  ];
  const decoded = decodeLegs(encodeLegs(legs));
  assert.deepEqual(decoded, legs);
  assert.equal(decoded[0]!.instrument, CALL);
});

check("an empty strategy encodes to an empty string and back", () => {
  assert.equal(encodeLegs([]), "");
  assert.deepEqual(decodeLegs(""), []);
  assert.deepEqual(decodeLegs(null), []);
  assert.deepEqual(decodeLegs(undefined), []);
});

check("B and S rather than 1 and -1, because a URL is read by people", () => {
  const legs: LegRequest[] = [{ instrument: CALL, direction: 1, quantity: 1 }];
  assert.equal(encodeLegs(legs), `${CALL}:B1`);
});

const MALFORMED: Array<[string, string]> = [
  ["a missing ':' separator", "DELTA-BTC-20260904-77000-C-USDB1"],
  ["a five-part pre-I1 instrument with no currency", "DELTA-BTC-20260904-77000-C:B1"],
  ["an instrument with an unknown right", "DELTA-BTC-20260904-77000-X-USD:B1"],
  ["a missing direction letter", `${CALL}:1`],
  ["an unknown direction letter", `${CALL}:X1`],
  ["a zero quantity", `${CALL}:B0`],
  ["a negative quantity", `${CALL}:B-2`],
  ["a fractional quantity", `${CALL}:B1.5`],
  ["a truncated entry price", `${CALL}:B1@`],
  ["one good leg and one broken", `${CALL}:B1,garbage`],
];

for (const [name, encoded] of MALFORMED) {
  check(`rejects ${name}`, () => {
    assert.throws(() => decodeLegs(encoded), LegsUrlError);
  });
}

check("the error names the fragment that failed, not just 'invalid'", () => {
  try {
    decodeLegs(`${CALL}:B1,garbage`);
    assert.fail("expected a LegsUrlError");
  } catch (err) {
    assert.ok(err instanceof LegsUrlError, "wrong error type");
    assert.match(err.message, /garbage/);
  }
});

check("never returns a partial strategy — one broken fragment, nothing decoded", () => {
  let decoded: unknown = "not assigned";
  try {
    decoded = decodeLegs(`${CALL}:B1,garbage`);
  } catch {
    /* expected */
  }
  assert.equal(decoded, "not assigned");
});

if (failures > 0) {
  console.error(`\n${failures} failed`);
  process.exit(1);
}
console.log("\nall passed");
