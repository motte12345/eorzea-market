"use client";

import { usePathname, useRouter } from "next/navigation";
import { ItemSearch } from "@/components/item-search";
import type { ItemSearchResult } from "@/lib/api";

export function SearchBar() {
  const pathname = usePathname();
  const router = useRouter();
  const isMarket = pathname.startsWith("/market");

  if (!isMarket) return null;

  function handleSelect(item: ItemSearchResult) {
    router.push(`/market/items/${item.id}`);
  }

  return (
    <div className="mx-auto max-w-7xl px-6 pt-3">
      <ItemSearch onSelect={handleSelect} placeholder="アイテム検索..." />
    </div>
  );
}
