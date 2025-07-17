import { db } from "@/db";
import { flags } from "@/db/schema";

export async function GET() {
  const flagsData = await db.select().from(flags);

  const urls = [
    ...flagsData.map(
      (flag) => `
        <url>
          <loc>https://vexilo.org/flag/${encodeURIComponent(flag.name)}</loc>
          <changefreq>weekly</changefreq>
          <priority>0.8</priority>
        </url>
      `
    ),
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${urls.join("")}
    </urlset>`;

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
