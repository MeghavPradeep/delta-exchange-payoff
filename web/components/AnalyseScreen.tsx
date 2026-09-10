"use client";

import { useEffect, useState } from "react";

import AnalyseView from "@/components/AnalyseView";
import {
  ContractViolationError,
  ENGINE_URL,
  EngineResponseError,
  EngineUnreachableError,
  postAnalyse,
} from "@/lib/engine";
import { LegsUrlError, decodeLegs } from "@/lib/legs-url";
import type { AnalyseResponse, LegRequest } from "@/lib/payoff";

/**
 * The strategy the link named, decoded exactly once — `ChainScreen.decodeInitialLegs`'s
 * rule and its reason. A malformed `legs=` is never treated as "no strategy":
 * `lib/legs-url.ts` throws naming the part that was wrong, and that message is carried
 * to the screen rather than the reader being started on an empty position their link
 * did not ask for.
 */
function decodeInitial(param: string | null): { legs: LegRequest[]; error: string | null } {
  try {
    return { legs: decodeLegs(param), error: null };
  } catch (err) {
    return {
      legs: [],
      error: err instanceof LegsUrlError ? err.message : String(err),
    };
  }
}

/**
 * One sentence for whatever went wrong, with the three kinds kept apart.
 *
 * A **refusal** is the engine answering — the request was understood and declined — and
 * its own sentence is the useful part, with the code beside it so the reason is
 * findable in `docs/payoff-contract.md`'s table. An **unreachable** engine is a local
 * condition and says where it tried. A **contract violation** is our own side's bug and
 * says so in full rather than being softened into "something went wrong".
 */
function problemOf(err: unknown): string {
  if (err instanceof EngineResponseError) {
    return `The engine declined this strategy (${err.status}): ${err.message}`;
  }
  if (err instanceof EngineUnreachableError) {
    return `Could not reach the engine at ${ENGINE_URL} — ${err.message}. Nothing is analysed.`;
  }
  if (err instanceof ContractViolationError) return err.message;
  return err instanceof Error ? err.message : String(err);
}

/**
 * The analyse tab: one request, and whatever came back.
 *
 * **One request, not a timer.** A link naming a minute is a fixed set of numbers, and a
 * live one keeping up with the market is #6's ticket, not this one — so this screen asks
 * once and renders the answer. That also keeps it clear of the wall clock entirely.
 *
 * The fetching is all that lives here; `AnalyseView` renders the result and is testable
 * without a browser because of that split.
 */
export default function AnalyseScreen({
  legsParam,
  minute,
}: {
  /** The raw `legs=` value, undecoded — the server component hands it down exactly as it
   * arrived, because a malformed one has to be reported rather than dropped, and a
   * server component has no notice to report it into. */
  legsParam: string | null;
  /** A stored minute, or `null` for live. Validated by `parseView` upstream. */
  minute: string | null;
}) {
  const [strategy] = useState(() => decodeInitial(legsParam));
  const [analysis, setAnalysis] = useState<AnalyseResponse | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (strategy.legs.length === 0) return;
    let dropped = false;
    setBusy(true);
    postAnalyse(strategy.legs, minute)
      .then((next) => {
        if (dropped) return;
        setAnalysis(next);
        setProblem(null);
      })
      .catch((err) => {
        if (!dropped) setProblem(problemOf(err));
      })
      .finally(() => {
        if (!dropped) setBusy(false);
      });
    return () => {
      dropped = true;
    };
  }, [strategy, minute]);

  return (
    <AnalyseView
      analysis={analysis}
      problem={problem}
      legsError={strategy.error}
      busy={busy}
      legCount={strategy.legs.length}
    />
  );
}
