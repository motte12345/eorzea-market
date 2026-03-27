"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatGil } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

interface PriceHistoryEntry {
  date: string;
  min_price: number;
  avg_price: number;
  max_price: number;
  volume: number;
  hq: boolean;
  data_center: string;
}

interface Props {
  data: PriceHistoryEntry[];
}

interface ChartDataPoint {
  date: string;
  min: number;
  avg: number;
  max: number;
  volume: number;
}

function aggregateByDate(data: PriceHistoryEntry[]): ChartDataPoint[] {
  const dateMap = new Map<string, { prices: number[]; volumes: number[] }>();

  for (const entry of data) {
    const existing = dateMap.get(entry.date);
    if (existing) {
      existing.prices.push(entry.avg_price);
      existing.volumes.push(entry.volume);
    } else {
      dateMap.set(entry.date, {
        prices: [entry.avg_price],
        volumes: [entry.volume],
      });
    }
  }

  return Array.from(dateMap.entries())
    .map(([date, { prices, volumes }]) => ({
      date,
      min: Math.min(...prices),
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      max: Math.max(...prices),
      volume: volumes.reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function PriceChart({ data }: Props) {
  const { t } = useTranslation();

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-[var(--muted-foreground)]">
        {t("noPriceHistory")}
      </p>
    );
  }

  const chartData = aggregateByDate(data);
  const labelMap: Record<string, string> = {
    avg: t("average"),
    min: t("lowest"),
    max: t("highest"),
  };

  return (
    <div className="space-y-4">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="var(--muted-foreground)"
              fontSize={11}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickFormatter={(v) => formatGil(v, false)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={formatDate}
              formatter={(value: number, name: string) => [
                `${formatGil(value)}`,
                labelMap[name] ?? name,
              ]}
            />
            <Legend formatter={(value) => labelMap[value] ?? value} />
            <Line
              type="monotone"
              dataKey="avg"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="min"
              stroke="var(--positive)"
              strokeWidth={1}
              strokeDasharray="4 2"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="max"
              stroke="var(--destructive)"
              strokeWidth={1}
              strokeDasharray="4 2"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
