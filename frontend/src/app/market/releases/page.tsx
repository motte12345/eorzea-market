import fs from "fs";
import path from "path";
import { ReleasesContent } from "./content";

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
  return <ReleasesContent releases={releases} />;
}
