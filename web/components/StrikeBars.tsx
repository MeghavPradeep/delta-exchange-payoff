"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Label,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cumulative, type StrikeBar } from "@/lib/exposure";
import { formatStrike } from "@/lib/format";

/**
 * A figure per strike, calls against puts, with the running total over the top.
 *
 * One chart for both screens. GEX and OI are the same picture — a call bar and a put bar
 * at every strike — and the only things that differ are the units and the labels, which
 * arrive as props. A second component would be this file with two formatters changed.
 *
 * **Puts are drawn downwards, and the bar's own value is not negative.** `lib/exposure.ts`
 * reports each side at its own size and keeps the sign in `net`, because a put's open
 * interest is not a negative quantity of anything. The mirroring is done here, at the
 * moment of drawing, which is where a convention belongs: the reader sees calls above the
 * axis and puts below, and the hover reports both as the positive counts they are.
 *
 * **`type="linear"` is not available to a bar chart and does not need to be** — a bar
 * stands on its own strike and nothing is interpolated between two of them, which is the
 * one thing `SmileChart` had to fight Recharts about. The strike axis is categorical here
 * for the same reason: a listed board is not evenly spaced in strike, and drawing it on a
 * numeric axis would leave bars of different widths claiming different sizes.
 *
 * **The cumulative line is a second series on a second axis**, and it is what the zero
 * crossing below is read off. It is drawn with no dots: it is context for the bars, not a
 * series anyone reads a number off — `SmileChart`'s rule about its overlays, for its
 * reason.
 *
 * **Nothing wears Recharts' own styling**, again per `SmileChart`: every colour is a
 * palette token passed as a prop as well as set in the stylesheet, there is no default
 * legend, and the tooltip is replaced outright. The library writes `#808080` and `#ccc`
 * into SVG presentation attributes where it is not told otherwise, and a class alone would
 * win in the cascade while leaving the grey in the markup for the next person to copy.
 */
export default function StrikeBars({
  bars,
  spot,
  atmStrike,
  zeroCross,
  axisTitle,
  format,
  showCumulative = true,
}: {
  bars: StrikeBar[];
  /** Marked on the axis so the board is read against where the price actually is. */
  spot: number | null;
  atmStrike: number | null;
  /** The strike where the running total changes sign, or `null`. */
  zeroCross: number | null;
  /** What the vertical axis is in — "USD per 1% move", "contracts". */
  axisTitle: string;
  /** How one figure is written. The screens own their units; this file owns the layout. */
  format: (value: number | null) => string;
  showCumulative?: boolean;
}) {
  const rows = useMemo(() => {
    const running = cumulative(bars);
    return bars.map((bar, i) => ({
      strike: bar.strike,
      call: bar.call,
      // Downwards at the moment of drawing, never in the data. See the header.
      put: bar.put === null ? null : -bar.put,
      putSize: bar.put,
      net: bar.net,
      total: running[i]!.total,
    }));
  }, [bars]);

  if (rows.length === 0) {
    return <p className="notice">No strikes on this board yet.</p>;
  }

  return (
    <div className="plot">
      <ResponsiveContainer width="100%" height={460}>
        <ComposedChart data={rows} margin={{ top: 24, right: 56, bottom: 40, left: 8 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="0" />

          <XAxis
            dataKey="strike"
            interval="preserveStartEnd"
            minTickGap={28}
            height={34}
            tickFormatter={(value: number) => formatStrike(value)}
            tick={{ fill: "var(--ink-faint)", fontSize: 11 }}
            tickLine={{ stroke: "var(--line-strong)" }}
            axisLine={{ stroke: "var(--line-strong)" }}
          >
            <Label
              className="chart-axis-title"
              fill="var(--ink-faint)"
              value="STRIKE"
              position="insideBottom"
              offset={-24}
            />
          </XAxis>

          <YAxis
            yAxisId="bars"
            width={78}
            tickFormatter={(value: number) => format(value)}
            tick={{ fill: "var(--ink-faint)", fontSize: 11 }}
            tickLine={{ stroke: "var(--line-strong)" }}
            axisLine={{ stroke: "var(--line-strong)" }}
          >
            <Label
              className="chart-axis-title"
              fill="var(--ink-faint)"
              value={axisTitle.toUpperCase()}
              angle={-90}
              position="insideLeft"
              style={{ textAnchor: "middle" }}
            />
          </YAxis>

          {/* The running total keeps its own axis: it is an order of magnitude larger
              than any single bar, and sharing a scale would flatten every bar to
              nothing. Its ticks are hidden — the line is read for its shape and its
              crossing, and a second set of numbers down the right would invite it to be
              read for a value it is not labelled precisely enough to give. */}
          <YAxis yAxisId="total" orientation="right" hide />

          {/* Zero is the line both signs are read against, so it is drawn rather than
              left to be inferred from where the bars stop. */}
          <ReferenceLine yAxisId="bars" y={0} stroke="var(--line-strong)" />

          {spot === null ? null : (
            <ReferenceLine
              yAxisId="bars"
              x={nearestOf(rows, spot)}
              stroke="var(--accent)"
              strokeDasharray="4 3"
            >
              <Label
                className="chart-mark"
                fill="var(--accent)"
                value={`spot ${formatStrike(spot)}`}
                position="top"
              />
            </ReferenceLine>
          )}

          {zeroCross === null ? null : (
            <ReferenceLine
              yAxisId="bars"
              x={zeroCross}
              stroke="var(--ink-soft)"
              strokeDasharray="1 4"
            >
              <Label
                className="chart-mark"
                fill="var(--ink-soft)"
                value="sign change"
                position="insideTopRight"
              />
            </ReferenceLine>
          )}

          <Tooltip
            cursor={{ fill: "var(--line)" }}
            content={<BarsTooltip format={format} atmStrike={atmStrike} />}
          />

          <Bar yAxisId="bars" dataKey="call" fill="var(--call)" isAnimationActive={false} />
          <Bar yAxisId="bars" dataKey="put" fill="var(--put)" isAnimationActive={false} />

          {showCumulative ? (
            <Line
              yAxisId="total"
              type="linear"
              dataKey="total"
              stroke="var(--overlay-1h)"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** The listed strike closest to a price — the bars stand on strikes, so a reference line
 *  drawn at an arbitrary price would float between two of them on a categorical axis. */
function nearestOf(rows: { strike: number }[], price: number): number {
  return rows.reduce((best, row) =>
    Math.abs(row.strike - price) < Math.abs(best.strike - price) ? row : best,
  ).strike;
}

interface Row {
  strike: number;
  call: number | null;
  putSize: number | null;
  net: number;
  total: number;
}

/**
 * The hover, replaced outright.
 *
 * It reports the put at its **own size**, not at the negative the chart drew, because the
 * negative is a drawing convention and a reader asking what is at this strike is asking
 * how much is there. The net carries the sign, and it is labelled as the net so the two
 * cannot be confused.
 */
function BarsTooltip({
  active,
  payload,
  format,
  atmStrike,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
  format: (value: number | null) => string;
  atmStrike: number | null;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]!.payload;
  return (
    <div className="chart-tip">
      <div className="chart-tip-head">
        {formatStrike(row.strike)}
        {atmStrike !== null && row.strike === atmStrike ? " · ATM" : ""}
      </div>
      {/* `.chart-tip-list` is the smile tooltip's own grid, reused rather than a second
          recipe for a label-left figure-right list. */}
      <dl className="chart-tip-list">
        <dt>Calls</dt>
        <dd>{format(row.call)}</dd>
        <dt>Puts</dt>
        <dd>{format(row.putSize)}</dd>
        <dt>Net</dt>
        <dd>{format(row.net)}</dd>
        <dt>Running</dt>
        <dd>{format(row.total)}</dd>
      </dl>
    </div>
  );
}
