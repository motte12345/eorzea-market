"use client";

import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getItem } from "@/lib/api";

interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // /market/items/[id] のパターンからアイテムIDを抽出
  const isItemPage =
    segments[0] === "market" && segments[1] === "items" && !!segments[2];
  const itemId = isItemPage ? Number(segments[2]) : null;

  // hooks は常に呼ぶ（条件分岐の前に）
  const { data: itemData } = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => getItem(itemId!),
    enabled: itemId !== null,
  });
  const itemName = itemData?.name_ja || itemData?.name_en || null;

  // トップページでは表示しない
  if (segments.length === 0) return null;

  // トップページでは非表示
  if (segments.length === 0) return null;

  const crumbs: Crumb[] = [{ label: "QP Tools", href: "/" }];

  if (segments[0] === "market") {
    crumbs.push(
      isItemPage
        ? { label: "マーケット", href: "/market" }
        : { label: "マーケット" }
    );

    if (isItemPage) {
      crumbs.push({ label: itemName || `#${itemId}` });
    }
  }

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
