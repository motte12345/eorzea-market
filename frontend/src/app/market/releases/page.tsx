"use client";

import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { useTranslation } from "@/lib/i18n";

export default function ReleasesPage() {
  const { t } = useTranslation();
  const [releases, setReleases] = useState<{ slug: string; content: string }[]>([]);

  useEffect(() => {
    fetch("/api/releases")
      .then((r) => r.json())
      .then(setReleases)
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <h1 className="text-2xl font-bold">{t("releaseNotes")}</h1>
      {releases.map((release) => (
        <article key={release.slug} className="release-note">
          <Markdown>{release.content}</Markdown>
        </article>
      ))}
    </div>
  );
}
