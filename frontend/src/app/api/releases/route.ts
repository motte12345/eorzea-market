import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export async function GET() {
  const dir = path.join(process.cwd(), "src/content/releases");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));

  const releases = files
    .map((f) => ({
      slug: f.replace(/\.md$/, ""),
      content: fs.readFileSync(path.join(dir, f), "utf-8"),
    }))
    .sort((a, b) => b.slug.localeCompare(a.slug));

  return NextResponse.json(releases);
}
