"use client";

import Markdown from "react-markdown";
import { useTranslation } from "@/lib/i18n";

interface Props {
  releases: { slug: string; content: string }[];
}

export function ReleasesContent({ releases }: Props) {
  const { t } = useTranslation();

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
