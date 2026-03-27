import fs from "fs";
import path from "path";
import { ReleasesContent } from "./content";

interface ReleaseFile {
  slug: string;
  ja: string;
  en: string;
}

function getReleaseFiles(): ReleaseFile[] {
  const dir = path.join(process.cwd(), "src/content/releases");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));

  // v1.0.md (ja) / v1.0.en.md (en) のペアを作る
  const jaFiles = files.filter((f) => !f.includes(".en."));
  return jaFiles
    .map((f) => {
      const slug = f.replace(/\.md$/, "");
      const enFile = `${slug}.en.md`;
      return {
        slug,
        ja: fs.readFileSync(path.join(dir, f), "utf-8"),
        en: files.includes(enFile)
          ? fs.readFileSync(path.join(dir, enFile), "utf-8")
          : fs.readFileSync(path.join(dir, f), "utf-8"),
      };
    })
    .sort((a, b) => b.slug.localeCompare(a.slug));
}

export default function ReleasesPage() {
  const releases = getReleaseFiles();
  return <ReleasesContent releases={releases} />;
}
