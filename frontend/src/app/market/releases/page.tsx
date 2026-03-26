import fs from "fs";
import path from "path";
import Markdown from "react-markdown";

function getReleaseFiles(): { slug: string; content: string }[] {
  const dir = path.join(process.cwd(), "src/content/releases");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));

  return files
    .map((f) => ({
      slug: f.replace(/\.md$/, ""),
      content: fs.readFileSync(path.join(dir, f), "utf-8"),
    }))
    .sort((a, b) => b.slug.localeCompare(a.slug));
}

export default function ReleasesPage() {
  const releases = getReleaseFiles();

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <h1 className="text-2xl font-bold">リリースノート</h1>
      {releases.map((release) => (
        <article key={release.slug} className="release-note">
          <Markdown>{release.content}</Markdown>
        </article>
      ))}
    </div>
  );
}
