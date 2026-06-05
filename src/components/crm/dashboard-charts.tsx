"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ChartDatum {
  label: string;
  value: number;
  color: string;
}

/** Shared categorical palette (CSS vars → follow light/dark theme). */
export const CHART_PALETTE = [
  "var(--info)",
  "var(--success)",
  "var(--warning)",
  "var(--secondary)",
  "var(--danger)",
  "var(--primary)",
  "var(--muted-2)",
];

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

const fmt = (kind: "currency" | "number") => (v: number) =>
  kind === "currency" ? usd.format(v) : compact.format(v);

const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
} as const;

/** Vertical bars — value across a small set of categories (stages, statuses…). */
export function PipelineBarChart({ data, kind = "currency" }: { data: ChartDatum[]; kind?: "currency" | "number" }) {
  const format = fmt(kind);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
        <YAxis
          tickFormatter={format}
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip formatter={(v) => format(Number(v))} cursor={{ fill: "var(--surface-2)" }} contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars — ranked top-N lists (products, branches, accounts…). */
export function HBarChart({ data, kind = "currency" }: { data: ChartDatum[]; kind?: "currency" | "number" }) {
  const format = fmt(kind);
  const height = Math.max(160, data.length * 40 + 16);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" tickFormatter={format} tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={120}
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip formatter={(v) => format(Number(v))} cursor={{ fill: "var(--surface-2)" }} contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Donut — share/distribution (counts by stage, value by branch…). */
export function StageDonut({
  data,
  kind = "number",
  unitLabel,
}: {
  data: ChartDatum[];
  kind?: "currency" | "number";
  unitLabel?: string;
}) {
  const format = fmt(kind);
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Tooltip
          formatter={(v) => (unitLabel ? `${format(Number(v))} ${unitLabel}` : format(Number(v)))}
          contentStyle={TOOLTIP_STYLE}
        />
        <Pie data={data} dataKey="value" nameKey="label" innerRadius={55} outerRadius={90} paddingAngle={2}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.color} stroke="var(--surface)" />
          ))}
        </Pie>
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground text-lg font-semibold"
        >
          {kind === "currency" ? usd.format(total) : compact.format(total)}
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Compact legend for donuts (label + colour swatch + value). */
export function ChartLegend({ data, kind = "number" }: { data: ChartDatum[]; kind?: "currency" | "number" }) {
  const format = fmt(kind);
  return (
    <ul className="mt-2 space-y-1 text-xs">
      {data.map((d) => (
        <li key={d.label} className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} aria-hidden />
            <span className="truncate text-muted">{d.label}</span>
          </span>
          <span className="tabular-nums">{format(d.value)}</span>
        </li>
      ))}
    </ul>
  );
}
