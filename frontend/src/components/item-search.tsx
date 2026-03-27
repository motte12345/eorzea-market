"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { searchItems, type ItemSearchResult } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";

interface Props {
  onSelect: (item: ItemSearchResult) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
}

export function ItemSearch({ onSelect, onSearch, placeholder }: Props) {
  const { t, name } = useTranslation();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: results } = useQuery({
    queryKey: ["search", query],
    queryFn: () => searchItems(query),
    enabled: query.length >= 2,
    staleTime: 30 * 1000,
  });

  const suggestions = results ?? [];

  useEffect(() => {
    setSelectedIndex(-1);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (!isOpen || selectedIndex < 0)) {
      e.preventDefault();
      if (onSearch && query.trim()) {
        onSearch(query.trim());
        setIsOpen(false);
      }
      return;
    }

    if (!isOpen || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[selectedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  function handleSelect(item: ItemSearchResult) {
    setQuery("");
    setIsOpen(false);
    onSelect(item);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? t("searchInputPlaceholder")}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none"
      />

      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg">
          {suggestions.map((item, i) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
                i === selectedIndex
                  ? "bg-[var(--muted)]"
                  : "hover:bg-[var(--muted)]"
              }`}
            >
              {item.icon_url && (
                <img src={item.icon_url} alt="" className="h-8 w-8 flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {name(item.name_ja, item.name_en)}
                </div>
                <div className="truncate text-xs text-[var(--muted-foreground)]">
                  {item.name_en}
                  {item.category && ` / ${item.category}`}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
