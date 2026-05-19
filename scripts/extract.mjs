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

// Running tally of embed conversions across the run, broken down by source
// format, for the EXTRACTION_REPORT.
const embedStats = {
  youtube_shortcode_attr: 0, // [youtube=URL]
  youtube_shortcode_paired: 0, // [youtube]ID[/youtube]
  youtube_flash: 0, // <object>/<embed> with youtube.com/v/{ID}
  vimeo_flash: 0, // moogaloop.swf?clip_id={ID}
  dailymotion_flash: 0, // dailymotion.com/swf/{ID}
  bandcamp_flash: 0, // bandcamp EmbeddedPlayer.swf
  kept_existing_iframe: 0, // iframe that was already present
  unrecoverable_flash: 0, // dead Flash services (BBC, MTV.it, MySpace, etc.)
};

function parsePermalink(url) {
  const m = url.match(/^\/(\d{4})\/(\d{2})\/(\d{2})\/([^/]+)\/?$/);
  if (!m) return null;
  // The sitemap percent-encodes non-ASCII slug characters; the filesystem
  // stores them as their decoded UTF-8 form. Decode so path lookups match.
  let slug;
  try {
    slug = decodeURIComponent(m[4]);
  } catch {
    slug = m[4];
  }
  return { year: m[1], month: m[2], day: m[3], slug };
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

function youtubeIframe(id) {
  return `<iframe width="560" height="315" src="https://www.youtube.com/embed/${id}" title="YouTube video" frameborder="0" allowfullscreen></iframe>`;
}
function vimeoIframe(id) {
  return `<iframe width="560" height="315" src="https://player.vimeo.com/video/${id}" title="Vimeo video" frameborder="0" allowfullscreen></iframe>`;
}
function dailymotionIframe(id) {
  return `<iframe width="560" height="315" src="https://www.dailymotion.com/embed/video/${id}" title="Dailymotion video" frameborder="0" allowfullscreen></iframe>`;
}
function bandcampIframe(opts) {
  // opts is the raw query string after EmbeddedPlayer.swf/
  return `<iframe style="border: 0; width: 100%; height: 120px;" src="https://bandcamp.com/EmbeddedPlayer/${opts}" seamless></iframe>`;
}

function detectYouTubeId(raw) {
  if (!raw) return null;
  const decoded = raw.replace(/&amp;/g, "&");
  const v = decoded.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
  if (v) return v[1];
  const youtuBe = decoded.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
  if (youtuBe) return youtuBe[1];
  const embedPath = decoded.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/);
  if (embedPath) return embedPath[1];
  const flashPath = decoded.match(/youtube\.com\/v\/([A-Za-z0-9_-]{6,})/);
  if (flashPath) return flashPath[1];
  const idAttr = decoded.match(/^id=([A-Za-z0-9_-]{6,})/);
  if (idAttr) return idAttr[1];
  return null;
}

function expandShortcodes(html) {
  let out = html;

  // Paired form: [youtube]ID-or-URL[/youtube]
  out = out.replace(/\[youtube\]\s*([^\[\s]+)\s*\[\/youtube\]/gi, (full, raw) => {
    const id = detectYouTubeId(raw) || (/^[A-Za-z0-9_-]{6,}$/.test(raw) ? raw : null);
    if (!id) return full;
    embedStats.youtube_shortcode_paired++;
    return youtubeIframe(id);
  });

  // Attribute form: [youtube=URL] or [youtube URL] or [youtube id=XYZ]
  out = out.replace(/\[youtube[=\s]([^\]]+)\]/gi, (full, raw) => {
    const id = detectYouTubeId(raw);
    if (!id) return full;
    embedStats.youtube_shortcode_attr++;
    return youtubeIframe(id);
  });

  return out;
}

// Walks the Cheerio tree, replacing Flash <object>/<embed> markup with modern
// <iframe> embeds where the source service is still alive. Unrecoverable
// Flash gets replaced with a Markdown-friendly note so we don't lose context.
function convertFlashEmbeds($scope, $) {
  // First pass: standalone <embed> tags and <embed> inside <object>.
  $scope.find("object, embed").each((_, el) => {
    if (!el.parent) return; // Already replaced this round.
    const $el = $(el);
    // If this <embed> sits inside an <object> that we'll handle separately, skip.
    if (el.tagName === "embed" && $el.parent("object").length > 0) return;

    // Gather candidate URLs from this node and its descendants.
    const candidates = [];
    if (el.tagName === "embed") {
      candidates.push($el.attr("src"));
    } else {
      // <object data="..."> or contains <param name="movie" value="..."> or <embed src="...">.
      candidates.push($el.attr("data"));
      $el.find("param").each((_, p) => {
        const $p = $(p);
        const name = ($p.attr("name") || "").toLowerCase();
        if (name === "movie" || name === "src") candidates.push($p.attr("value"));
      });
      $el.find("embed").each((_, e) => candidates.push($(e).attr("src")));
    }
    const url = candidates.find((u) => u && u.trim()) || "";
    const decoded = url.replace(/&amp;/g, "&");
    let replacement = null;

    let m;
    if ((m = decoded.match(/youtube\.com\/v\/([A-Za-z0-9_-]{6,})/))) {
      replacement = youtubeIframe(m[1]);
      embedStats.youtube_flash++;
    } else if ((m = decoded.match(/vimeo\.com\/moogaloop\.swf\?clip_id=(\d+)/))) {
      replacement = vimeoIframe(m[1]);
      embedStats.vimeo_flash++;
    } else if ((m = decoded.match(/dailymotion\.com\/swf\/([A-Za-z0-9]+)/))) {
      replacement = dailymotionIframe(m[1]);
      embedStats.dailymotion_flash++;
    } else if ((m = decoded.match(/bandcamp\.com\/EmbeddedPlayer\.swf\/([^"'\s]+)/))) {
      // Modern bandcamp embed URL strips the .swf suffix and uses /EmbeddedPlayer/.
      replacement = bandcampIframe(m[1].replace(/\/$/, "") + "/");
      embedStats.bandcamp_flash++;
    } else if (decoded) {
      // Recognisable Flash but service is dead — leave a visible note so the
      // future static site doesn't silently lose evidence the embed existed.
      embedStats.unrecoverable_flash++;
      const label = decoded.length > 80 ? decoded.slice(0, 77) + "…" : decoded;
      replacement = `<p><em>[Flash embed — unrecoverable: ${label}]</em></p>`;
    }

    if (replacement) {
      $el.replaceWith(replacement);
    }
  });

  // Also count any iframes that are already in the source — these survive as-is.
  $scope.find("iframe").each(() => {
    embedStats.kept_existing_iframe++;
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
  // Expand WordPress [youtube] shortcodes before parsing.
  const expanded = expandShortcodes(html);
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

function resolvePostFile(meta) {
  const baseDir = path.join(ROOT, meta.year, meta.month, meta.day);
  // First try the decoded slug exactly.
  let candidate = path.join(baseDir, meta.slug, "index.html");
  if (existsSync(candidate)) return candidate;
  // The static mirror dropped some non-ASCII characters from directory names
  // (e.g. ellipsis, curly apostrophes). Try stripping non-ASCII and collapsing
  // any double-hyphens that result.
  const stripped = meta.slug
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/-{2,}/g, "-");
  if (stripped !== meta.slug) {
    candidate = path.join(baseDir, stripped, "index.html");
    if (existsSync(candidate)) {
      meta.slug = stripped;
      return candidate;
    }
  }
  return null;
}

async function extractPost(url) {
  const meta = parsePermalink(url);
  if (!meta) {
    failures.push({ url, reason: "URL did not match permalink pattern" });
    return null;
  }
  const filePath = resolvePostFile(meta);
  if (!filePath) {
    failures.push({ url, reason: "index.html not found for " + url });
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

  convertFlashEmbeds($body, $);
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
    if ($cBody.length) convertFlashEmbeds($cBody, $);
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
  convertFlashEmbeds($body, $);
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
  console.log("\nEmbed conversions:");
  for (const [k, v] of Object.entries(embedStats)) console.log(`  ${k}: ${v}`);
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
        embeds: embedStats,
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
