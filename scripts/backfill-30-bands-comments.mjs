#!/usr/bin/env node
/*
 * backfill-30-bands-comments.mjs — fetch the comments behind WordPress's
 * "Older Comments" pagination on the 30-South-African-bands post and
 * merge them into the existing comments JSON for that post.
 *
 * # Why
 *
 * Task 1's extractor walked each post's main URL but didn't follow
 * `?cpage=N` / `/comment-page-N/` pagination. Only one post in the corpus
 * has more than ~50 comments — the 2007 30-South-African-bands post —
 * so it's the only one affected. Migration currently has 41 of the 163
 * comments; this script fetches /comment-page-1/ and merges the missing
 * ~113 in.
 *
 * # Sources, in order
 *
 *   1. https://www.burgoblog.com/.../comment-page-1/ — preferred.
 *   2. If that 4xx's: ask the Wayback availability API for the most
 *      recent snapshot of the same URL, fetch with the `if_` flag so
 *      we get raw archived HTML (no toolbar), parse from there.
 *
 *   The Simply Static export at burgoblog.com skips /comment-page-N/
 *   paths as duplicate content during crawl, so the Wayback path is
 *   the expected one in practice. If both 4xx, the script accepts the
 *   loss, leaves the JSON untouched, and exits cleanly.
 *
 * # Dependencies
 *
 * - Node 18+ (uses global fetch).
 * - cheerio (already in the root package.json).
 *
 *   cd <repo root>
 *   npm install
 *
 * # Usage
 *
 *   # Dry run — fetches and prints the merged size, doesn't write.
 *   node scripts/backfill-30-bands-comments.mjs --dry-run
 *
 *   # Real run — fetches, merges, sorts oldest-first, writes.
 *   node scripts/backfill-30-bands-comments.mjs
 *
 *   # Override the source URL if needed.
 *   node scripts/backfill-30-bands-comments.mjs \
 *     --url https://web.archive.org/web/2024if_/https://www.burgoblog.com/2007/12/07/30-south-african-bands-you-need-to-hear/comment-page-1/
 *
 * # Outputs
 *
 *   site/src/content/comments/30-south-african-bands-you-need-to-hear.json
 *
 *   The script overwrites this file with the deduped, oldest-first merge.
 *
 * # Verifying the run
 *
 *   - Script prints `final count: N` at the end. Expected ~163, give or
 *     take a few for hidden/spam-filtered comments.
 *   - After it finishes:
 *
 *       cd site
 *       npm run build
 *       npm run preview
 *
 *     Then open /2007/12/07/30-south-african-bands-you-need-to-hear/ and
 *     scroll to the comments section. Comments.astro renders all entries
 *     in one continuous flow — should display all ~163.
 *
 * # Dedup strategy
 *
 *   By (author, date_iso) tuple. Task 1 didn't capture WP comment IDs,
 *   and authors are not unique by themselves (the existing data has
 *   multiple "Burgo" replies). The ISO timestamp is to the second so
 *   collisions are vanishingly unlikely in practice.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const COMMENTS_JSON = path.join(
  REPO,
  'site/src/content/comments/30-south-african-bands-you-need-to-hear.json',
);

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
let url =
  'https://www.burgoblog.com/2007/12/07/30-south-african-bands-you-need-to-hear/comment-page-1/';
const urlIdx = args.indexOf('--url');
if (urlIdx !== -1 && args[urlIdx + 1]) url = args[urlIdx + 1];

const USER_AGENT =
  'burgoblog-static recovery script (https://github.com/MBurgo/burgoblog-static)';

const log = (...a) => console.log('[backfill-comments]', ...a);

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_',
  hr: '---',
});
turndown.keep(['iframe']);

/* ---------- Fetch with retry ---------- */
//
// Returns { ok: true, body } on success, { ok: false, status } on
// non-retryable failure (e.g. 404). Retries 429/5xx with exponential
// backoff up to MAX attempts (2s/4s/8s/16s).

async function fetchWithRetry(target) {
  const MAX = 4;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(target, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*;q=0.5' },
        redirect: 'follow',
      });
      if (!res.ok) {
        if ((res.status === 429 || res.status >= 500) && attempt < MAX) {
          const delay = 2000 * 2 ** attempt;
          log(`  ${res.status} — retrying in ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        return { ok: false, status: res.status };
      }
      const body = await res.text();
      return { ok: true, body };
    } catch (e) {
      if (attempt < MAX) {
        const delay = 2000 * 2 ** attempt;
        log(`  transport error ${e.message} — retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return { ok: false, status: `ERR:${e.message}` };
    }
  }
}

/* ---------- Wayback Machine fallback ---------- */
//
// The live burgoblog.com is a Simply Static export and doesn't include
// /comment-page-N/ paths — Simply Static treats them as duplicate
// content during crawl, so the URL 404s on the static mirror even
// though the comments were rendered to HTML on the original WP site.
// When that happens, ask the Wayback availability API for the most
// recent snapshot of the original URL and parse comments from that.
//
// The Wayback availability API:
//   https://archive.org/help/wayback_api.php
//
// We rewrite the returned snapshot URL to use the `if_` flag, which
// returns the raw archived HTML without the Wayback toolbar — the
// WordPress comment markup in there is byte-identical to what the
// live site emitted, so the existing cheerio selectors work.

async function waybackUrlFor(originalUrl) {
  const api = `https://archive.org/wayback/available?url=${encodeURIComponent(originalUrl)}`;
  const r = await fetchWithRetry(api);
  if (!r.ok) {
    log(`  Wayback availability API returned ${r.status}`);
    return null;
  }
  try {
    const json = JSON.parse(r.body);
    const snap = json?.archived_snapshots?.closest;
    if (!snap?.available || !snap.url) return null;
    return snap.url.replace(/\/web\/(\d+)\//, '/web/$1if_/');
  } catch (e) {
    log(`  Wayback availability response was not JSON: ${e.message}`);
    return null;
  }
}

/* ---------- Parse comments from WordPress HTML ---------- */
// Mirrors the selector logic in scripts/extract.mjs so the merged comments
// match Task 1's output exactly.

function parseComments(html) {
  const $ = cheerio.load(html);
  const out = [];
  $('#comments .comment').each((_, el) => {
    const $c = $(el);
    const author = $c.find('.comment-author .fn').first().text().trim();
    const datetime =
      $c.find('.comment-metadata time').first().attr('datetime') || '';
    const $body = $c.find('.comment-content').first().clone();
    $body.find('script, style').remove();
    const bodyHtml = $body.html() || '';
    const md = turndown.turndown(bodyHtml).trim();
    if (!author && !md) return;
    out.push({
      author: author || 'Anonymous',
      // Strip timezone the same way Task 1 did:
      //   2007-12-09T08:42:13+00:00 -> 2007-12-09T08:42:13
      date: datetime.replace(/([+-]\d{2}):?(\d{2})$/, '').replace('Z', ''),
      body: md,
      reply_to: null,
    });
  });
  return out;
}

/* ---------- Main ---------- */

async function main() {
  const existingRaw = await readFile(COMMENTS_JSON, 'utf8');
  const existing = JSON.parse(existingRaw);
  log(`existing comments: ${existing.length}`);
  log(`primary source: ${url}`);
  log(`mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

  log('fetching from burgoblog.com...');
  let html = null;
  let source = url;
  const primary = await fetchWithRetry(url);
  if (primary.ok) {
    html = primary.body;
    log(`  got ${html.length} bytes of HTML from primary source`);
  } else if (typeof primary.status === 'number' && primary.status >= 400 && primary.status < 500) {
    // 4xx from burgoblog.com — fall back to Wayback. The static mirror at
    // burgoblog.com is a Simply Static export and Simply Static skips
    // /comment-page-N/ paths as duplicate content during crawl, so this is
    // the expected path for this script.
    log(`  primary returned ${primary.status} — querying Wayback availability API`);
    const waybackTarget = await waybackUrlFor(url);
    if (!waybackTarget) {
      log('!! No Wayback snapshot exists for that URL either. Accepting the loss.');
      log('   This branch will keep the existing 41-comment JSON. Final count: ' + existing.length);
      return;
    }
    log(`  Wayback snapshot: ${waybackTarget}`);
    const fallback = await fetchWithRetry(waybackTarget);
    if (!fallback.ok) {
      log(`!! Wayback fetch failed: ${fallback.status}. Accepting the loss.`);
      log('   This branch will keep the existing 41-comment JSON. Final count: ' + existing.length);
      return;
    }
    html = fallback.body;
    source = waybackTarget;
    log(`  got ${html.length} bytes of HTML from Wayback`);
  } else {
    log(`!! Primary fetch failed (status ${primary.status}) and the error wasn't a 4xx — not falling back. Re-run later.`);
    process.exit(1);
  }

  const fetched = parseComments(html);
  log(`parsed ${fetched.length} comments from ${source.includes('web.archive.org') ? 'Wayback snapshot' : '/comment-page-1/'}`);
  if (fetched.length === 0) {
    log('!! Parsed zero comments from the source HTML. Either the page has no');
    log('   #comments .comment elements (wrong URL?) or the markup has changed.');
    log('   Re-run with --url and a known-good snapshot if needed.');
    process.exit(1);
  }

  // Dedupe by (author, date) — Task 1 didn't capture comment IDs.
  const key = (c) => `${c.author} ${c.date}`;
  const seen = new Set(existing.map(key));
  const added = [];
  for (const c of fetched) {
    if (!seen.has(key(c))) {
      seen.add(key(c));
      added.push(c);
    }
  }
  log(`new (not already in JSON): ${added.length}`);

  const merged = [...existing, ...added].sort((a, b) => {
    // Oldest-first (matches the existing file's ordering).
    return a.date.localeCompare(b.date);
  });
  log(`final count: ${merged.length}`);

  if (DRY_RUN) {
    log('Dry run finished — no file written.');
    if (added.length > 0) {
      log('Sample new entries:');
      for (const c of added.slice(0, 3)) {
        log(`  ${c.date}  ${c.author}: ${c.body.slice(0, 80).replace(/\n/g, ' ')}…`);
      }
    }
    return;
  }

  await writeFile(COMMENTS_JSON, JSON.stringify(merged, null, 2) + '\n');
  log(`wrote ${path.relative(REPO, COMMENTS_JSON)}`);
}

main().catch((e) => {
  console.error('[backfill-comments] FATAL:', e);
  process.exit(1);
});
