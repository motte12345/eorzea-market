import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatGil(value: number, showUnit = true): string {
  const formatted = value.toLocaleString("ja-JP");
  return showUnit ? `${formatted}ギル` : formatted;
}

export function calcArbitrageProfit(
  buyPrice: number,
  sellPrice: number,
  buyRate: number,
  sellRate: number,
): { cost: number; revenue: number; profit: number; rate: number } {
  const cost = Math.floor(buyPrice * (1 + buyRate));
  const revenue = Math.floor(sellPrice * (1 - sellRate));
  const profit = revenue - cost;
  const rate = cost > 0 ? (profit / cost) * 100 : 0;
  return { cost, revenue, profit, rate };
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
}
