#!/usr/bin/env node
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import TurndownService from "turndown";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");
const POSTS_DIR = path.join(CONTENT, "posts");
const PAGES_DIR = path.join(CONTENT, "pages");
const COMMENTS_DIR = path.join(CONTENT, "comments");
const TAX_DIR = path.join(CONTENT, "taxonomies");

const args = process.argv.slice(2);
const onlyUrls = new Set();
const flags = new Set();
for (const a of args) {
  if (a.startsWith("--")) flags.add(a);
  else onlyUrls.add(a);
}
const SAMPLE_MODE = flags.has("--sample");
const PAGES_MODE = flags.has("--pages");
const TAX_MODE = flags.has("--taxonomies");

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "_",
  hr: "---",
});

// Keep <iframe> tags as raw HTML.
turndown.keep(["iframe"]);

// Custom rule: <blockquote cite="..."> → blockquote with trailing source line.
turndown.addRule("blockquoteWithCite", {
  filter: (node) => node.nodeName === "BLOCKQUOTE" && node.getAttribute("cite"),
  replacement: (content, node) => {
    const cite = node.getAttribute("cite");
    const lines = content
      .replace(/^\n+|\n+$/g, "")
      .split("\n")
      .map((l) => "> " + l)
      .join("\n");
    return "\n\n" + lines + "\n>\n> — [source](" + cite + ")\n\n";
  },
});

const failures = [];

function parsePermalink(url) {
  const m = url.match(/^\/(\d{4})\/(\d{2})\/(\d{2})\/([^/]+)\/?$/);
  if (!m) return null;
  return { year: m[1], month: m[2], day: m[3], slug: m[4] };
}

function decodeEntities(s) {
  if (s == null) return s;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#8230;/g, "…")
    .replace(/&nbsp;/g, " ");
}

function yamlEscape(s) {
  if (s == null) return '""';
  const str = String(s);
  if (/^[A-Za-z0-9 _.,/:\-]+$/.test(str) && !/^\s|\s$/.test(str) && !/^[-?:|>%@`]/.test(str)) {
    return str;
  }
  return '"' + str.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

function yamlList(items) {
  if (!items || items.length === 0) return "[]";
  return "[" + items.map((i) => yamlEscape(i)).join(", ") + "]";
}

async function loadSitemapUrls() {
  const xml = await readFile(path.join(ROOT, "post-sitemap.xml"), "utf8");
  const urls = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml))) {
    const u = m[1].trim();
    if (u === "/" || u === "") continue;
    urls.push(u);
  }
  return urls;
}

function expandYoutubeShortcodes(html) {
  // [youtube=URL] or [youtube URL] or [youtube id=XYZ]
  return html.replace(/\[youtube[=\s]([^\]]+)\]/gi, (full, raw) => {
    let id = null;
    const v = raw.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
    const youtuBe = raw.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
    const embedPath = raw.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/);
    const idAttr = raw.match(/^id=([A-Za-z0-9_-]{6,})/);
    if (v) id = v[1];
    else if (youtuBe) id = youtuBe[1];
    else if (embedPath) id = embedPath[1];
    else if (idAttr) id = idAttr[1];
    if (!id) return full;
    return `<iframe width="560" height="315" src="https://www.youtube.com/embed/${id}" title="YouTube video" frameborder="0" allowfullscreen></iframe>`;
  });
}

function cleanBodyHtml($body, $) {
  // Strip scripts and style tags.
  $body.find("script, style, noscript").remove();
  // Strip empty paragraphs (after trimming whitespace and nbsp).
  $body.find("p").each((_, el) => {
    const $p = $(el);
    const text = $p.text().replace(/ |\s/g, "");
    if (!text && $p.find("img, iframe, video, audio, embed, object").length === 0) {
      $p.remove();
    }
  });
  // Unwrap wp-block-* divs but keep their content. Repeat to handle nesting.
  for (let i = 0; i < 5; i++) {
    const wraps = $body.find('div[class*="wp-block-"]');
    if (wraps.length === 0) break;
    wraps.each((_, el) => {
      const $el = $(el);
      $el.replaceWith($el.contents());
    });
  }
  // Remove any leftover sharing/jetpack widgets if present.
  $body.find(".sharedaddy, .jp-relatedposts, .yarpp-related, .wp-block-buttons").remove();
  // Drop screen-reader-text spans.
  $body.find(".screen-reader-text").remove();
}

function htmlToMarkdown(html) {
  // Expand [youtube=URL] shortcodes first.
  const expanded = expandYoutubeShortcodes(html);
  const md = turndown.turndown(expanded);
  // Collapse 3+ blank lines to 2.
  return md.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function extractTaxonomyFromArticleClass(articleClass) {
  const categories = [];
  const tags = [];
  for (const cls of articleClass.split(/\s+/)) {
    if (cls.startsWith("category-")) {
      categories.push(cls.slice("category-".length));
    } else if (cls.startsWith("tag-")) {
      tags.push(cls.slice("tag-".length));
    }
  }
  return { categories, tags };
}

function normalizeImageSrc(src) {
  if (!src) return null;
  // Drop query params (e.g. ?ver=...) for cleanliness.
  const cleaned = src.split("?")[0];
  // Convert absolute burgoblog URLs to relative paths.
  return cleaned.replace(/^https?:\/\/[^/]+/i, "");
}

function extractFeaturedImage($) {
  const og = $('meta[property="og:image"]').attr("content");
  if (og) {
    const norm = normalizeImageSrc(og);
    if (norm && norm.startsWith("/wp-content/uploads/")) return norm;
  }
  // Fallback: first image in entry-content under /wp-content/uploads/.
  const firstImg = $("article .entry-content").first().find("img").first().attr("src");
  if (firstImg) {
    const norm = normalizeImageSrc(firstImg);
    if (norm && norm.startsWith("/wp-content/uploads/")) return norm;
  }
  return null;
}

function extractCommentCount($) {
  const txt = $("article .post-comment-link a").first().text().trim();
  if (!txt) return 0;
  if (/no comments?/i.test(txt)) return 0;
  const m = txt.match(/(\d+)\s+(?:Comment|Reply|Replies)/i);
  if (m) return parseInt(m[1], 10);
  // Some "1 Comment" without "Reply" — captured above. Default fallback.
  const just = txt.match(/^(\d+)/);
  return just ? parseInt(just[1], 10) : 0;
}

function extractAuthor($) {
  const meta = $('meta[name="author"]').attr("content");
  if (meta) return meta.trim();
  const byline = $("article .post-author .meta-text a").first().text().trim();
  return byline || "Burgo";
}

function extractTitle($) {
  const h1 = $("article .entry-title").first().text().trim();
  if (h1) return decodeEntities(h1);
  const og = $('meta[property="og:title"]').attr("content") || "";
  return decodeEntities(og.replace(/ \| Burgo's Music Blog$/, "").trim());
}

async function extractPost(url) {
  const meta = parsePermalink(url);
  if (!meta) {
    failures.push({ url, reason: "URL did not match permalink pattern" });
    return null;
  }
  const filePath = path.join(ROOT, url.replace(/^\//, ""), "index.html");
  if (!existsSync(filePath)) {
    failures.push({ url, reason: "index.html not found at " + filePath });
    return null;
  }
  const html = await readFile(filePath, "utf8");
  const $ = cheerio.load(html, { decodeEntities: false });

  const $article = $("article.post").first();
  if ($article.length === 0) {
    failures.push({ url, reason: "no <article class='post...'> element" });
    return null;
  }

  const title = extractTitle($);
  const articleClass = $article.attr("class") || "";
  const { categories, tags } = extractTaxonomyFromArticleClass(articleClass);
  const author = extractAuthor($);
  const featured_image = extractFeaturedImage($);
  const comment_count = extractCommentCount($);

  // Body — strictly the entry-content inside the post article, not inside comments.
  // Use find but filter out anything inside .comment-content.
  let $body = $article.find("> .post-inner .entry-content, > .post-inner > .entry-content, > .entry-content").first();
  if ($body.length === 0) {
    // Fallback: first .entry-content that is NOT inside a comment.
    $article.find(".entry-content").each((_, el) => {
      if ($body.length) return;
      const $el = $(el);
      if ($el.parents(".comment-content, .comment").length === 0) {
        $body = $el;
      }
    });
  }
  if ($body.length === 0) {
    $body = $article.find(".post-content").first();
  }
  if ($body.length === 0) {
    failures.push({ url, reason: "could not locate .entry-content body" });
    return null;
  }

  // Restore LiteSpeed lazy-loaded iframe srcs so embeds actually work.
  $body.find("iframe").each((_, el) => {
    const $if = $(el);
    const lazySrc = $if.attr("data-litespeed-src");
    if (lazySrc) $if.attr("src", lazySrc);
    $if.removeAttr("data-litespeed-src").removeAttr("data-lazyloaded").removeAttr("loading");
  });

  // Rewrite image srcs and ensure alt attrs exist.
  $body.find("img").each((_, el) => {
    const $img = $(el);
    const lazy = $img.attr("data-litespeed-src");
    const src = normalizeImageSrc(lazy || $img.attr("src") || $img.attr("data-src") || "");
    if (src) $img.attr("src", src);
    if (!$img.attr("alt")) $img.attr("alt", "");
    // Drop srcset/sizes — turndown ignores them anyway.
    $img.removeAttr("srcset").removeAttr("data-od-added-sizes").removeAttr("data-od-unknown-tag").removeAttr("sizes").removeAttr("data-litespeed-src").removeAttr("data-lazyloaded");
  });

  cleanBodyHtml($body, $);

  const bodyHtml = $body.html() || "";
  const markdown = htmlToMarkdown(bodyHtml);

  // Comments.
  const comments = [];
  $("#comments .comment").each((_, el) => {
    const $c = $(el);
    // Only top-level .comment items (every commit has unique id, but nested .comment may also match — that's fine, flat array.).
    const cAuthor = $c.find(".comment-author .fn").first().text().trim();
    const cDate = $c.find(".comment-metadata time").first().attr("datetime") || "";
    const $cBody = $c.find(".comment-content").first().clone();
    $cBody.find("script, style").remove();
    const cMd = $cBody.length ? htmlToMarkdown($cBody.html() || "").trim() : "";
    if (cAuthor || cMd) {
      comments.push({
        author: cAuthor || "Anonymous",
        date: cDate.replace(/([+-]\d{2}):?(\d{2})$/, "").replace("Z", ""),
        body: cMd,
        reply_to: null,
      });
    }
  });

  // Frontmatter.
  const permalink = `/${meta.year}/${meta.month}/${meta.day}/${meta.slug}/`;
  const fm = [
    "---",
    `title: ${yamlEscape(title)}`,
    `slug: ${yamlEscape(meta.slug)}`,
    `date: ${meta.year}-${meta.month}-${meta.day}`,
    `author: ${yamlEscape(author)}`,
    `categories: ${yamlList(categories)}`,
    `tags: ${yamlList(tags)}`,
    `featured_image: ${featured_image ? yamlEscape(featured_image) : "null"}`,
    `comment_count: ${comment_count}`,
    `permalink: ${yamlEscape(permalink)}`,
    "---",
    "",
  ].join("\n");

  const filename = `${meta.year}-${meta.month}-${meta.day}-${meta.slug}.md`;
  await mkdir(POSTS_DIR, { recursive: true });
  await writeFile(path.join(POSTS_DIR, filename), fm + markdown);

  if (comments.length > 0) {
    await mkdir(COMMENTS_DIR, { recursive: true });
    await writeFile(
      path.join(COMMENTS_DIR, `${meta.slug}.json`),
      JSON.stringify(comments, null, 2) + "\n"
    );
  }

  return {
    url,
    slug: meta.slug,
    date: `${meta.year}-${meta.month}-${meta.day}`,
    title,
    categories,
    tags,
    comments: comments.length,
  };
}

async function extractStaticPage(slug) {
  const filePath = path.join(ROOT, slug, "index.html");
  if (!existsSync(filePath)) {
    failures.push({ url: `/${slug}/`, reason: "static page index.html not found" });
    return null;
  }
  const html = await readFile(filePath, "utf8");
  const $ = cheerio.load(html, { decodeEntities: false });

  const $article = $("article").first();
  const title = decodeEntities($article.find(".entry-title").first().text().trim() ||
    ($('meta[property="og:title"]').attr("content") || "").replace(/ \| Burgo's Music Blog$/, "").trim());

  let $body = $article.find(".entry-content").first();
  if ($body.length === 0) {
    failures.push({ url: `/${slug}/`, reason: "static page entry-content missing" });
    return null;
  }
  $body.find("img").each((_, el) => {
    const $img = $(el);
    const src = normalizeImageSrc($img.attr("src") || "");
    if (src) $img.attr("src", src);
    if (!$img.attr("alt")) $img.attr("alt", "");
    $img.removeAttr("srcset").removeAttr("data-od-added-sizes").removeAttr("data-od-unknown-tag").removeAttr("sizes");
  });
  cleanBodyHtml($body, $);
  const markdown = htmlToMarkdown($body.html() || "");

  const fm = [
    "---",
    `title: ${yamlEscape(title)}`,
    `slug: ${yamlEscape(slug)}`,
    `permalink: ${yamlEscape(`/${slug}/`)}`,
    "---",
    "",
  ].join("\n");

  await mkdir(PAGES_DIR, { recursive: true });
  await writeFile(path.join(PAGES_DIR, `${slug}.md`), fm + markdown);
  return { slug, title };
}

async function extractTaxonomyDisplayName(kind, slug) {
  // kind = "tag" | "category"
  const filePath = path.join(ROOT, kind, slug, "index.html");
  if (!existsSync(filePath)) return slug;
  const html = await readFile(filePath, "utf8");
  const m = html.match(/<h1[^>]*archive-title[^>]*>([\s\S]*?)<\/h1>/);
  if (!m) return slug;
  const inner = m[1];
  // The display name is in the trailing <span>.
  const spans = [...inner.matchAll(/<span(?:\s[^>]*)?>([\s\S]*?)<\/span>/g)];
  if (spans.length === 0) return slug;
  return decodeEntities(spans[spans.length - 1][1].trim());
}

async function buildTaxonomies(postSummaries) {
  await mkdir(TAX_DIR, { recursive: true });

  const tagCounts = new Map();
  const catCounts = new Map();
  for (const p of postSummaries) {
    for (const t of p.tags) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    for (const c of p.categories) catCounts.set(c, (catCounts.get(c) || 0) + 1);
  }

  // Cross-reference with archive directories on disk to capture any taxonomies
  // that exist as archives but never appear in a sitemap'd post.
  const onDiskTags = existsSync(path.join(ROOT, "tag")) ? await readdir(path.join(ROOT, "tag")) : [];
  const onDiskCats = existsSync(path.join(ROOT, "category")) ? await readdir(path.join(ROOT, "category")) : [];

  const tagSlugs = new Set([...tagCounts.keys(), ...onDiskTags]);
  const catSlugs = new Set([...catCounts.keys(), ...onDiskCats]);

  const tags = [];
  for (const slug of [...tagSlugs].sort()) {
    const name = await extractTaxonomyDisplayName("tag", slug);
    tags.push({ slug, name, post_count: tagCounts.get(slug) || 0 });
  }
  const categories = [];
  for (const slug of [...catSlugs].sort()) {
    const name = await extractTaxonomyDisplayName("category", slug);
    categories.push({ slug, name, post_count: catCounts.get(slug) || 0 });
  }

  await writeFile(path.join(TAX_DIR, "tags.json"), JSON.stringify(tags, null, 2) + "\n");
  await writeFile(path.join(TAX_DIR, "categories.json"), JSON.stringify(categories, null, 2) + "\n");
  return { tagCount: tags.length, catCount: categories.length };
}

async function main() {
  const allUrls = await loadSitemapUrls();
  let urls = allUrls;
  if (onlyUrls.size > 0) {
    urls = allUrls.filter((u) => onlyUrls.has(u));
    const missing = [...onlyUrls].filter((u) => !urls.includes(u));
    for (const u of missing) {
      failures.push({ url: u, reason: "URL not present in post-sitemap.xml" });
    }
  }

  console.log(`Total URLs in post-sitemap.xml: ${allUrls.length}`);
  console.log(`Extracting ${urls.length} post${urls.length === 1 ? "" : "s"}.`);

  const summaries = [];
  for (const u of urls) {
    try {
      const r = await extractPost(u);
      if (r) summaries.push(r);
    } catch (err) {
      failures.push({ url: u, reason: "exception: " + err.message });
    }
  }

  let pageResults = [];
  if (PAGES_MODE || (!SAMPLE_MODE && onlyUrls.size === 0)) {
    const staticSlugs = ["about-3", "contact", "popular-posts", "music-policy", "want-your-band-featured-here"];
    for (const slug of staticSlugs) {
      const r = await extractStaticPage(slug);
      if (r) pageResults.push(r);
    }
  }

  let taxResult = null;
  if (TAX_MODE || (!SAMPLE_MODE && onlyUrls.size === 0)) {
    taxResult = await buildTaxonomies(summaries);
  }

  console.log(`\nExtracted ${summaries.length} posts.`);
  if (pageResults.length) console.log(`Extracted ${pageResults.length} static pages.`);
  if (taxResult) console.log(`Built taxonomies: ${taxResult.tagCount} tags, ${taxResult.catCount} categories.`);
  if (failures.length) {
    console.log(`\nFailures (${failures.length}):`);
    for (const f of failures) console.log(`  - ${f.url}: ${f.reason}`);
  } else {
    console.log("\nNo failures.");
  }

  // Persist a run summary for the report.
  await mkdir(CONTENT, { recursive: true });
  await writeFile(
    path.join(CONTENT, ".last-run.json"),
    JSON.stringify(
      {
        total_sitemap_urls: allUrls.length,
        extracted_posts: summaries.length,
        pages: pageResults.length,
        failures,
        mode: { sample: SAMPLE_MODE, pages_only: PAGES_MODE, taxonomies_only: TAX_MODE, only: [...onlyUrls] },
      },
      null,
      2
    ) + "\n"
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
