import Parser from "rss-parser";
import sanitizeHtml from "sanitize-html";
import { readOpdFeeds } from "@/lib/opd-feeds";

const FEED_URL = "https://acehbaratkab.go.id/berita/sitemap";
const parser = new Parser();
const MAX_SITEMAPS = 8;
const MAX_SITEMAP_URLS = 100;
const MAX_ARTICLE_FETCHES = 40;

export const dynamic = "force-dynamic";

type FeedSource = { id: string; name: string; url: string };
type SitemapEntry = {
  url: string;
  lastModified: string | null;
  title: string | null;
  publishedAt: string | null;
  image: string | null;
};

function safeHttpUrl(value: string | undefined, fallback: string): string {
  try {
    const url = new URL(value ?? fallback);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function firstImage(content: string): string | null {
  const safeImages = sanitizeHtml(content, {
    allowedTags: ["img"],
    allowedAttributes: { img: ["src", "alt"] },
    allowedSchemes: ["http", "https"],
  });
  const source = safeImages.match(/<img\b[^>]*\bsrc="([^"]+)"/i)?.[1];
  if (!source) return null;

  try {
    const url = new URL(source);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, encoded: string) => {
    if (encoded[0] === "#") {
      const codePoint = encoded[1]?.toLowerCase() === "x"
        ? Number.parseInt(encoded.slice(2), 16)
        : Number.parseInt(encoded.slice(1), 10);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[encoded.toLowerCase()] ?? entity;
  });
}

function xmlValue(block: string, tag: string): string | null {
  const escapedTag = tag.replace(":", "\\:");
  const value = block.match(new RegExp(`<${escapedTag}\\b[^>]*>([\\s\\S]*?)<\\/${escapedTag}\\s*>`, "i"))?.[1];
  return value ? decodeEntities(value.trim()) : null;
}

function sitemapEntries(xml: string): { isIndex: boolean; entries: SitemapEntry[] } {
  const isIndex = /<sitemapindex\b/i.test(xml);
  const elementName = isIndex ? "sitemap" : "url";
  const blocks = xml.match(new RegExp(`<${elementName}\\b[^>]*>[\\s\\S]*?<\\/${elementName}\\s*>`, "gi")) ?? [];
  const entries = blocks.flatMap((block) => {
    const url = xmlValue(block, "loc");
    if (!url) return [];
    return [{
      url,
      lastModified: xmlValue(block, "lastmod"),
      title: xmlValue(block, "news:title"),
      publishedAt: xmlValue(block, "news:publication_date"),
      image: xmlValue(block, "image:loc"),
    }];
  });
  return { isIndex, entries };
}

function allowedArticleUrl(value: string, baseUrl: string): string | null {
  try {
    const url = new URL(value, baseUrl);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      !(host === "acehbaratkab.go.id" || host.endsWith(".acehbaratkab.go.id")) ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchSourceText(url: string, timeout = 12_000): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mita/1.0 (news feed reader)" },
    signal: AbortSignal.timeout(timeout),
    redirect: "error",
    next: { revalidate: 180 },
  });
  if (!response.ok) throw new Error(`Sumber berita merespons ${response.status}.`);
  const content = await response.text();
  if (content.length > 5_000_000) throw new Error("Ukuran sumber berita melebihi batas.");
  return content;
}

function plainText(value: string): string {
  return decodeEntities(sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }))
    .replace(/\s+/g, " ")
    .trim();
}

function htmlMeta(html: string, key: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const name = tag.match(/\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (name?.toLowerCase() !== key.toLowerCase()) continue;
    const content = tag.match(/\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const value = content?.[1] ?? content?.[2] ?? content?.[3];
    if (value) return decodeEntities(value.trim());
  }
  return null;
}

function articleMetadata(html: string): {
  title: string | null;
  excerpt: string;
  image: string | null;
  publishedAt: string | null;
} {
  const pageTitle = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title = htmlMeta(html, "og:title")
    ?? htmlMeta(html, "twitter:title")
    ?? (pageTitle ? plainText(pageTitle) : null);
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? "";
  const description = htmlMeta(html, "description")
    ?? htmlMeta(html, "og:description")
    ?? htmlMeta(html, "twitter:description");
  const excerpt = plainText(description ?? article).slice(0, 800);
  const image = safeHttpUrl(htmlMeta(html, "og:image") ?? htmlMeta(html, "twitter:image") ?? undefined, "");
  const structuredDate = html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1] ?? null;
  const publishedAt = htmlMeta(html, "article:published_time")
    ?? structuredDate
    ?? htmlMeta(html, "date")
    ?? html.match(/<time\b[^>]*\bdatetime=["']([^"']+)["']/i)?.[1]
    ?? null;
  return { title: title || null, excerpt, image: image || null, publishedAt };
}

function titleFromUrl(value: string): string {
  const rawSlug = new URL(value).pathname.split("/").filter(Boolean).at(-1) ?? "Berita";
  let slug = rawSlug;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    console.warn(`Slug artikel tidak dapat di-decode: ${rawSlug}`);
  }
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("id-ID"));
}

async function feedItems(source: FeedSource, content: string) {
  const feed = await parser.parseString(content);
  return (feed.items ?? []).map((item, index) => {
    const body = item.content ?? item["content:encoded"] ?? item.contentSnippet ?? "";
    return {
      id: `${source.id}:${item.guid ?? item.link ?? `${item.title ?? "berita"}-${index}`}`,
      title: item.title?.trim() ?? "Berita tanpa judul",
      link: safeHttpUrl(item.link, source.url),
      pubDate: item.isoDate ?? item.pubDate ?? null,
      excerpt: plainText(item.contentSnippet ?? body),
      categories: item.categories ?? [],
      image: firstImage(body),
      sourceName: source.name,
      sourceUrl: source.url,
    };
  });
}

async function loadSitemapSource(source: FeedSource, initialXml: string) {
  const queue = [source.url];
  const seenSitemaps = new Set<string>();
  const entries = new Map<string, SitemapEntry>();

  while (queue.length > 0 && seenSitemaps.size < MAX_SITEMAPS && entries.size < MAX_SITEMAP_URLS) {
    const sitemapUrl = queue.shift()!;
    if (seenSitemaps.has(sitemapUrl)) continue;
    seenSitemaps.add(sitemapUrl);
    const xml = sitemapUrl === source.url ? initialXml : await fetchSourceText(sitemapUrl);
    const parsed = sitemapEntries(xml);
    for (const entry of parsed.entries) {
      if (parsed.isIndex) {
        const childUrl = allowedArticleUrl(entry.url, sitemapUrl);
        if (childUrl && !seenSitemaps.has(childUrl) && queue.length + seenSitemaps.size < MAX_SITEMAPS) {
          queue.push(childUrl);
        }
      } else {
        const articleUrl = allowedArticleUrl(entry.url, sitemapUrl);
        if (articleUrl && !entries.has(articleUrl)) {
          entries.set(articleUrl, { ...entry, url: articleUrl });
        }
      }
      if (entries.size >= MAX_SITEMAP_URLS) break;
    }
  }

  const sortedEntries = [...entries.values()].sort((a, b) => {
    const dateA = Date.parse(a.publishedAt ?? a.lastModified ?? "") || 0;
    const dateB = Date.parse(b.publishedAt ?? b.lastModified ?? "") || 0;
    return dateB - dateA;
  });
  const fetchableEntries = sortedEntries.filter((entry) => !entry.title).slice(0, MAX_ARTICLE_FETCHES);
  const metadataByUrl = new Map<string, Awaited<ReturnType<typeof articleMetadata>>>();
  await Promise.all(
    Array.from({ length: Math.min(8, fetchableEntries.length) }, async (_, worker) => {
      for (let index = worker; index < fetchableEntries.length; index += 8) {
        const entry = fetchableEntries[index];
        try {
          const html = await fetchSourceText(entry.url, 8_000);
          metadataByUrl.set(entry.url, articleMetadata(html));
        } catch (error) {
          console.warn(`Gagal memuat artikel dari sitemap (${entry.url}):`, error);
        }
      }
    }),
  );

  return sortedEntries.map((entry) => {
    const metadata = metadataByUrl.get(entry.url);
    return {
      id: `${source.id}:${entry.url}`,
      title: entry.title ?? metadata?.title ?? titleFromUrl(entry.url),
      link: entry.url,
      pubDate: entry.publishedAt ?? metadata?.publishedAt ?? entry.lastModified,
      excerpt: metadata?.excerpt ?? "",
      categories: [],
      image: entry.image ? safeHttpUrl(entry.image, "") || null : metadata?.image ?? null,
      sourceName: source.name,
      sourceUrl: source.url,
    };
  });
}

async function loadSource(source: FeedSource) {
  const content = await fetchSourceText(source.url);
  if (/<(?:\w+:)?(?:urlset|sitemapindex)\b/i.test(content)) {
    return loadSitemapSource(source, content);
  }
  return feedItems(source, content);
}

export async function GET() {
  try {
    const registeredFeeds = await readOpdFeeds();
    const sources: FeedSource[] = [
      { id: "kabupaten", name: "Pemkab Aceh Barat", url: FEED_URL },
      ...registeredFeeds
        .filter((feed) => feed.enabled)
        .map((feed) => ({ id: feed.id, name: feed.name, url: feed.feedUrl })),
    ];
    const results = await Promise.allSettled(sources.map(loadSource));
    const primaryResult = results[0];
    if (primaryResult.status === "rejected") throw primaryResult.reason;

    const items = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
    items.sort((a, b) => {
      const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return dateB - dateA;
    });

    const sourceFailures = results.flatMap((result, index) =>
      result.status === "rejected"
        ? [{ name: sources[index].name, error: "Feed tidak dapat dimuat." }]
        : [],
    );

    return Response.json({
      items,
      updatedAt: new Date().toISOString(),
      source: FEED_URL,
      sources: sources.map(({ id, name, url }) => ({ id, name, url })),
      sourceFailures,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan saat memuat feed.";
    console.error("Gagal memuat feed berita:", error);
    return Response.json({ error: message }, { status: 502 });
  }
}
