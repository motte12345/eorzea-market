"use client";

import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getItem } from "@/lib/api";

interface Crumb {
  label: string;
  href?: string;
}

function useItemName(itemId: number | null) {
  const { data } = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => getItem(itemId!),
    enabled: itemId !== null,
  });
  return data?.name_ja || data?.name_en || null;
}

export function Breadcrumb() {
  const pathname = usePathname();

  // パスを解析してパンくずを生成
  const segments = pathname.split("/").filter(Boolean);

  // トップページでは表示しない
  if (segments.length === 0) return null;

  // /market/items/[id] のパターンからアイテムIDを抽出
  const isItemPage =
    segments[0] === "market" && segments[1] === "items" && segments[2];
  const itemId = isItemPage ? Number(segments[2]) : null;
  const itemName = useItemName(itemId);

  const crumbs: Crumb[] = [{ label: "QP Tools", href: "/" }];

  if (segments[0] === "market") {
    crumbs.push({ label: "マーケット", href: "/market" });

    if (isItemPage) {
      crumbs.push({ label: itemName || `#${itemId}` });
    }
  }

  // 1階層（/market のみ）なら表示不要
  if (crumbs.length <= 1) return null;

  return (
    <nav className="mx-auto max-w-7xl px-6 pt-3">
      <ol className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
        {crumbs.map((crumb, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span className="mx-1">/</span>}
            {crumb.href ? (
              <a
                href={crumb.href}
                className="hover:text-[var(--primary)] transition-colors"
              >
                {crumb.label}
              </a>
            ) : (
              <span className="text-[var(--foreground)]">{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
