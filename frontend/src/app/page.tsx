"use client";

import { useTranslation } from "@/lib/i18n";

interface Tool {
  name: string;
  descriptionKey: "toolDescription";
  href: string;
  icon: string;
  status: "active" | "coming-soon";
}

const tools: Tool[] = [
  {
    name: "Eorzea Market",
    descriptionKey: "toolDescription",
    href: "/market",
    icon: "/market-icon.png",
    status: "active",
  },
];

export default function PortalPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-12 pt-12">
      <div className="text-center">
        <img src="/icon.png" alt="" className="mx-auto mb-4 h-16 w-16" />
        <h1 className="text-4xl font-bold text-[var(--primary)]">
          QP Tools
        </h1>
      </div>

      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        {tools.map((tool) => (
          <a
            key={tool.name}
            href={tool.status === "active" ? tool.href : undefined}
            className={`group rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 transition-all ${
              tool.status === "active"
                ? "hover:border-[var(--primary)] hover:shadow-lg hover:shadow-[var(--primary)]/5"
                : "opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="flex items-start gap-4">
              <img src={tool.icon} alt="" className="h-12 w-12 flex-shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold group-hover:text-[var(--primary)] transition-colors">
                    {tool.name}
                  </h2>
                  {tool.status === "coming-soon" && (
                    <span className="rounded bg-[var(--muted)] px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]">
                      Coming Soon
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {t(tool.descriptionKey)}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
