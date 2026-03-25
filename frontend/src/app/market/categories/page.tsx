"use client";

import { useQuery } from "@tanstack/react-query";

interface Category {
  category: string;
  item_count: number;
}

interface CategorySection {
  title: string;
  subsections?: { title: string; categories: string[] }[];
  categories?: string[];
}

const CATEGORY_ORDER: CategorySection[] = [
  {
    title: "メインアーム/サブアーム",
    subsections: [
      {
        title: "バトルジョブ",
        categories: [
          "片手剣", "斧", "両手剣", "ガンブレード", "槍", "両手鎌",
          "格闘武器", "刀", "双剣", "二刀流武器",
          "弓", "銃", "投擲武器", "呪具", "魔道書", "細剣",
          "筆", "幻具", "魔道書(学者専用)", "天球儀", "賢具",
        ],
      },
      {
        title: "クラフター",
        categories: [
          "木工道具", "鍛冶道具", "甲冑道具", "彫金道具",
          "革細工道具", "裁縫道具", "錬金道具", "調理道具",
        ],
      },
      {
        title: "ギャザラー",
        categories: ["採掘道具", "園芸道具", "漁道具", "釣り餌"],
      },
    ],
  },
  {
    title: "防具/アクセサリ",
    categories: [
      "盾", "頭防具", "胴防具", "手防具", "脚防具", "足防具",
      "耳飾り", "首飾り", "腕輪", "指輪",
    ],
  },
  {
    title: "その他",
    categories: [
      "薬品", "食材", "調理品", "水産物",
      "石材", "金属材", "木材", "布材", "皮革材", "骨材",
      "錬金術材", "染料", "部品", "マテリア", "クリスタル", "触媒",
      "雑貨", "雑貨(シーズナル)", "雑貨(修得/登録系)", "ミニオン",
      "飛空艇・潜水艦部品", "オーケストリオン関連品",
    ],
  },
  {
    title: "ハウジング",
    categories: [
      "外装建材", "内装建材", "庭具",
      "調度品(一般)", "調度品(椅子・寝台)", "調度品(台座)",
      "調度品(卓上)", "調度品(壁掛)", "調度品(敷物)",
      "栽培用品", "絵画",
    ],
  },
];

export default function CategoriesPage() {
  const { data } = useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const res = await fetch("/api/categories/");
      return res.json();
    },
  });

  const countMap = new Map<string, number>();
  const listedCategories = new Set<string>();
  if (data) {
    for (const cat of data) countMap.set(cat.category, cat.item_count);
  }

  // 定義済みカテゴリを記録
  for (const section of CATEGORY_ORDER) {
    if (section.categories) {
      for (const c of section.categories) listedCategories.add(c);
    }
    if (section.subsections) {
      for (const sub of section.subsections) {
        for (const c of sub.categories) listedCategories.add(c);
      }
    }
  }

  // 未分類カテゴリ
  const unlisted = data
    ?.filter((c) => !listedCategories.has(c.category))
    .sort((a, b) => a.category.localeCompare(b.category, "ja")) ?? [];

  function renderCategoryCard(cat: string) {
    const count = countMap.get(cat);
    if (count === undefined) return null;
    return (
      <a
        key={cat}
        href={`/market/categories/${encodeURIComponent(cat)}`}
        className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm transition-colors hover:border-[var(--primary)]"
      >
        <span>{cat}</span>
        <span className="text-xs text-[var(--muted-foreground)]">{count}件</span>
      </a>
    );
  }

  function renderCategories(categories: string[]) {
    return (
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {categories.map((cat) => renderCategoryCard(cat))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">カテゴリ一覧</h2>

      {data &&
        CATEGORY_ORDER.map((section) => (
          <div key={section.title} className="space-y-4">
            <h3 className="border-b border-[var(--border)] pb-1 text-lg font-bold text-[var(--primary)]">
              {section.title}
            </h3>

            {section.categories && renderCategories(section.categories)}

            {section.subsections?.map((sub) => (
              <div key={sub.title} className="space-y-2">
                <h4 className="text-sm font-bold text-[var(--muted-foreground)]">
                  {sub.title}
                </h4>
                {renderCategories(sub.categories)}
              </div>
            ))}
          </div>
        ))}

      {unlisted.length > 0 && (
        <div className="space-y-4">
          <h3 className="border-b border-[var(--border)] pb-1 text-lg font-bold text-[var(--primary)]">
            その他のカテゴリ
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {unlisted.map((cat) => renderCategoryCard(cat.category))}
          </div>
        </div>
      )}
    </div>
  );
}
