"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartDatum = { name: string; value: number; color?: string };
type SalesDatum = { month: string; sales: number };
type ProductDatum = { name: string; leads: number };

function useChartReady() {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return ready;
}

function ChartPlaceholder() {
  return (
    <div className="flex h-full min-h-56 w-full items-center justify-center rounded-2xl bg-slate-50 text-sm font-semibold text-slate-400">
      No chart data yet
    </div>
  );
}

export function LeadStatusDonut({
  total = 0,
  data = [],
  detailedLegend = false,
}: {
  total?: number;
  data?: ChartDatum[];
  detailedLegend?: boolean;
}) {
  const ready = useChartReady();
  if (!ready || !data.length) return <ChartPlaceholder />;

  if (detailedLegend) {
    return (
      <div className="grid h-full grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="relative h-[292px] rounded-[24px] bg-[radial-gradient(circle_at_center,#ffffff_0%,#f8fbff_62%,#eff6ff_100%)]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} innerRadius={78} outerRadius={112} paddingAngle={2} dataKey="value">
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color ?? "#2563EB"} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [value, "Leads"]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className="rounded-full bg-white/95 px-8 py-7 shadow-[0_18px_36px_rgba(37,99,235,0.08)]">
              <p className="text-4xl font-black tracking-[-0.03em] text-slate-950">{total}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Total Leads</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {data.map((item) => {
            const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
            return (
              <div key={item.name} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 shadow-sm">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color ?? "#2563EB" }} />
                    <span className="truncate font-semibold text-slate-700">{item.name}</span>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-slate-500">{item.value} ({percent}%)</span>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full" style={{ width: `${percent}%`, background: item.color ?? "#2563EB" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-1 items-center gap-3 md:grid-cols-[1fr_auto]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} innerRadius={54} outerRadius={82} paddingAngle={3} dataKey="value">
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color ?? "#2563EB"} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-2 text-xs">
        <div className="mb-2 rounded-2xl bg-slate-50 p-3 text-center">
          <p className="text-2xl font-black text-slate-950">{total}</p>
          <p className="font-semibold text-slate-500">Total leads</p>
        </div>
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color ?? "#2563EB" }} />
            <span className="text-slate-600">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SalesLineChart({ data = [] }: { data?: SalesDatum[] }) {
  const ready = useChartReady();
  if (!ready || !data.length) return <ChartPlaceholder />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(value) => [`BDT ${value}`, "Sales"]} />
        <Line type="monotone" dataKey="sales" stroke="#2563EB" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ProductBarChart({ data = [] }: { data?: ProductDatum[] }) {
  const ready = useChartReady();
  if (!ready || !data.length) return <ChartPlaceholder />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 34, right: 20, top: 6, bottom: 6 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
        <XAxis type="number" hide />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={92} axisLine={false} tickLine={false} />
        <Tooltip />
        <Bar dataKey="leads" radius={[0, 8, 8, 0]} fill="#2563EB" barSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TeamActivityDonut() {
  const ready = useChartReady();
  const data = [
    { name: "Calls", value: 34, color: "#2563EB" },
    { name: "Meetings", value: 21, color: "#16A34A" },
    { name: "Follow-ups", value: 28, color: "#F59E0B" },
    { name: "Notes", value: 17, color: "#8B5CF6" },
  ];

  if (!ready) return <ChartPlaceholder />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} innerRadius={48} outerRadius={76} paddingAngle={4} dataKey="value">
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ConversionFunnel({ data = [] }: { data?: ChartDatum[] }) {
  if (!data.length) return <ChartPlaceholder />;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      {data.map((item, index) => (
        <div key={item.name} className="flex w-full items-center justify-center gap-3">
          <div
            className="h-10 rounded-sm shadow-sm"
            style={{
              width: `${item.value}%`,
              background: item.color ?? "#2563EB",
              clipPath: `polygon(${index * 4}% 0, ${100 - index * 4}% 0, ${90 - index * 5}% 100%, ${10 + index * 5}% 100%)`,
            }}
          />
          <span className="w-28 text-xs font-semibold text-slate-600">{item.name}</span>
        </div>
      ))}
    </div>
  );
}
