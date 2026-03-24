"use client";

import { usePathname, useRouter } from "next/navigation";
import { ItemSearch } from "@/components/item-search";
import type { ItemSearchResult } from "@/lib/api";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const showSearch = pathname.startsWith("/market");

  function handleSelect(item: ItemSearchResult) {
    router.push(`/market/items/${item.id}`);
  }

  return (
    <header className="border-b border-[var(--border)] px-6 py-3">
      <div className="mx-auto flex max-w-7xl items-center gap-4">
        <a href="/" className="flex flex-shrink-0 items-center gap-2">
          <img src="/icon.png" alt="" className="h-8 w-8" />
          <span className="text-xl font-bold text-[var(--primary)]">
            QP Tools
          </span>
        </a>

        {showSearch && (
          <div className="flex-1">
            <ItemSearch
              onSelect={handleSelect}
              placeholder="アイテム検索..."
            />
          </div>
        )}
        {!showSearch && <div className="flex-1" />}

        <nav className="flex flex-shrink-0 gap-4 text-sm">
          <a href="/" className="hover:text-[var(--primary)]">
            ホーム
          </a>
          <a href="/market" className="hover:text-[var(--primary)]">
            マーケット
          </a>
        </nav>
      </div>
    </header>
  );
}
