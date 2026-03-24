"use client";

import { useQuery } from "@tanstack/react-query";

interface Category {
  category: string;
  item_count: number;
}

export default function CategoriesPage() {
  const { data } = useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const res = await fetch("/api/categories/");
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">カテゴリ一覧</h2>

      {data && (
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {data.map((cat) => (
            <a
              key={cat.category}
              href={`/market/categories/${encodeURIComponent(cat.category)}`}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 transition-colors hover:border-[var(--primary)]"
            >
              <span className="text-sm">{cat.category}</span>
              <span className="text-xs text-[var(--muted-foreground)]">
                {cat.item_count}件
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
