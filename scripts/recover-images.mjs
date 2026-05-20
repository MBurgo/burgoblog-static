#!/usr/bin/env node
/*
 * recover-images.mjs — fetch the 84 missing image files that
 * MIGRATION_IMAGE_AUDIT.md flagged as broken, saving them under
 * site/public/wp-content/ (or site/public/files/) so the migrated posts'
 * existing references resolve.
 *
 * # Why
 *
 * Task 1's WordPress static mirror was incomplete. Refs in three shapes are
 * absent from the mirror but still resolve on the live burgoblog.com:
 *   - /wp-content/<file>           (70 refs, mostly 2007/2008)
 *   - /files/YYYY/MM/<file>        (8 refs, pre-self-host era — try
 *                                   burgoblog.com first, then Wayback)
 * Three additional widget refs were stripped in a separate commit, not
 * fetched.
 *
 * # Dependencies
 *
 * - Node 18+ (uses global fetch).
 * - No additional packages — pure stdlib.
 *
 * # Usage
 *
 *   # Dry run — prints what would be fetched, doesn't touch the network
 *   # or the filesystem.
 *   node scripts/recover-images.mjs --dry-run
 *
 *   # Real run — fetches and writes.
 *   node scripts/recover-images.mjs
 *
 *   # Verbose progress on every attempt.
 *   node scripts/recover-images.mjs --verbose
 *
 * # Outputs
 *
 *   - site/public/wp-content/<file>          (recovered from burgoblog.com)
 *   - site/public/wp-content/uploads/...     (rare 2009-2012 refs)
 *   - site/public/files/YYYY/MM/<file>       (recovered, either source)
 *   - site/MIGRATION_IMAGE_AUDIT.md          (rewritten with recovery counts)
 *
 * # Verifying the run
 *
 *   - The script prints a summary at the end: recovered from burgoblog.com,
 *     recovered from Wayback, still broken, bytes downloaded.
 *   - After it finishes, run `python3 scripts/audit-images.py` (or the
 *     inline audit logic at the bottom of MIGRATION_IMAGE_AUDIT.md) to
 *     confirm the broken count has dropped.
 *   - Spot-check by loading /2007/12/07/30-south-african-bands-you-need-to-hear/
 *     in `npm run preview` from site/.
 *
 * # Behavior
 *
 *   - 1 second between requests, exponential backoff on 429/5xx
 *     (max 4 retries: 2s, 4s, 8s, 16s).
 *   - 50 MB total download cap; halts and reports if exceeded.
 *   - Refuses to overwrite existing files (skips with a message).
 *   - Saves alongside its source so MIGRATION_IMAGE_AUDIT.md stays the
 *     authoritative ledger of what was broken / recovered / still missing.
 */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const AUDIT = path.join(REPO, 'site', 'MIGRATION_IMAGE_AUDIT.md');
const PUBLIC = path.join(REPO, 'site', 'public');

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const VERBOSE = args.has('--verbose');
const REQUEST_GAP_MS = 1000;
const MAX_RETRIES = 4;
const TOTAL_BYTES_CAP = 50 * 1024 * 1024; // 50 MB

const USER_AGENT =
  'burgoblog-static recovery script (https://github.com/MBurgo/burgoblog-static)';

const log = (...a) => console.log('[recover-images]', ...a);
const vlog = (...a) => {
  if (VERBOSE) console.log('[recover-images]', ...a);
};

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/* ---------- Parse MIGRATION_IMAGE_AUDIT.md ---------- */

async function parseAudit() {
  const text = await readFile(AUDIT, 'utf8');
  // Each `### <postfile>` heading is followed by `- <ref> (kind)` lines.
  const refs = [];
  const blocks = text.split(/^### `/m).slice(1);
  for (const block of blocks) {
    const postLine = block.split('`', 1)[0];
    const post = postLine.trim();
    const body = block.slice(postLine.length);
    const re = /^- `([^`]+)`\s*\(([^)]+)\)/gm;
    let m;
    while ((m = re.exec(body)) !== null) {
      refs.push({ post, src: m[1], kind: m[2] });
    }
  }
  return refs;
}

/* ---------- Classify each ref ---------- */

const WIDGET_REFS = new Set([
  '/en_AU/i/scr/pixel.gif',
  '/public/resources/img/embed/make-a-mixtape.gif',
  '/7xjnjh3.jpg',
]);

function classify(src) {
  if (WIDGET_REFS.has(src)) return { kind: 'widget', skip: true };
  if (src.startsWith('/wp-content/uploads/')) {
    return { kind: 'wp-upload', dest: src };
  }
  if (src.startsWith('/wp-content/')) {
    return { kind: 'wp-content', dest: src };
  }
  if (src.startsWith('/files/')) {
    return { kind: 'files', dest: src };
  }
  return { kind: 'unknown', skip: true };
}

/* ---------- Fetch with retry + rate limit ---------- */

let totalBytes = 0;
let lastRequestAt = 0;

async function throttledFetch(url) {
  const now = Date.now();
  const wait = Math.max(0, REQUEST_GAP_MS - (now - lastRequestAt));
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
  return fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'image/*,*/*;q=0.5' },
    redirect: 'follow',
  });
}

async function fetchWithRetry(url) {
  let attempt = 0;
  for (;;) {
    try {
      const res = await throttledFetch(url);
      if (res.status === 404) return { ok: false, status: 404 };
      if (!res.ok) {
        if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
          const delay = 2000 * 2 ** attempt;
          vlog(`  ${res.status} from ${url} — backing off ${delay}ms`);
          await sleep(delay);
          attempt++;
          continue;
        }
        return { ok: false, status: res.status };
      }
      const buf = Buffer.from(await res.arrayBuffer());
      totalBytes += buf.byteLength;
      if (totalBytes > TOTAL_BYTES_CAP) {
        return { ok: false, status: 'CAP_EXCEEDED' };
      }
      return { ok: true, body: buf, contentType: res.headers.get('content-type') };
    } catch (e) {
      if (attempt < MAX_RETRIES) {
        const delay = 2000 * 2 ** attempt;
        vlog(`  transport error ${e.message} — retrying in ${delay}ms`);
        await sleep(delay);
        attempt++;
        continue;
      }
      return { ok: false, status: `ERR:${e.message}` };
    }
  }
}

/* ---------- Wayback resolution ---------- */
// https://archive.org/help/wayback_api.php — return the closest snapshot URL
// for a given original URL. We hit /raw/.../<url> via the closest snapshot
// from the available_api response, which gives us the original byte stream
// (not the Wayback HTML wrapper).

async function waybackUrlFor(originalUrl) {
  const api = `https://archive.org/wayback/available?url=${encodeURIComponent(originalUrl)}`;
  const r = await fetchWithRetry(api);
  if (!r.ok) return null;
  try {
    const json = JSON.parse(r.body.toString('utf8'));
    const snap = json?.archived_snapshots?.closest;
    if (!snap?.available || !snap.url) return null;
    // Force /raw/ so we get the original bytes, not the toolbar-wrapped page.
    return snap.url.replace(/\/web\/(\d+)\//, '/web/$1if_/');
  } catch {
    return null;
  }
}

/* ---------- Disk I/O ---------- */

function destPath(ref) {
  // Strip the leading slash so path.join doesn't escape PUBLIC.
  return path.join(PUBLIC, ref.replace(/^\/+/, ''));
}

async function fileExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function saveFile(ref, body) {
  const out = destPath(ref);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, body);
}

/* ---------- Main ---------- */

async function main() {
  const refs = await parseAudit();
  log(`Audit lists ${refs.length} broken refs across ${new Set(refs.map((r) => r.post)).size} posts.`);
  log(`Mode: ${DRY_RUN ? 'DRY RUN (no network, no writes)' : 'LIVE'}`);

  const results = {
    recovered_burgoblog: [],
    recovered_wayback: [],
    skipped_widget: [],
    skipped_unknown: [],
    skipped_existing: [],
    still_broken: [],
  };

  // Dedupe refs (some appear twice — once inline, once featured_image).
  const seen = new Set();
  const uniq = [];
  for (const r of refs) {
    if (seen.has(r.src)) continue;
    seen.add(r.src);
    uniq.push(r);
  }
  log(`${uniq.length} unique URLs to attempt.`);

  for (const r of uniq) {
    const c = classify(r.src);
    if (c.skip && c.kind === 'widget') {
      results.skipped_widget.push(r);
      vlog(`SKIP widget   ${r.src}`);
      continue;
    }
    if (c.skip) {
      results.skipped_unknown.push(r);
      vlog(`SKIP unknown  ${r.src}`);
      continue;
    }
    const dst = destPath(c.dest);
    if (!DRY_RUN && (await fileExists(dst))) {
      results.skipped_existing.push(r);
      vlog(`SKIP exists   ${c.dest}`);
      continue;
    }

    if (DRY_RUN) {
      log(`would fetch  ${r.src}  ->  ${path.relative(REPO, dst)}`);
      continue;
    }

    const primary = `https://www.burgoblog.com${r.src}`;
    log(`fetch ${r.src}`);
    const first = await fetchWithRetry(primary);
    if (first.status === 'CAP_EXCEEDED') {
      log(`!! 50 MB cap exceeded — stopping. Re-run after raising the cap.`);
      break;
    }
    if (first.ok) {
      await saveFile(c.dest, first.body);
      results.recovered_burgoblog.push(r);
      vlog(`  ok ${first.body.length} bytes`);
      continue;
    }
    vlog(`  burgoblog.com -> ${first.status}; trying Wayback`);

    const waybackTarget = await waybackUrlFor(primary);
    if (!waybackTarget) {
      results.still_broken.push({ ...r, reason: `burgoblog ${first.status}; no Wayback snapshot` });
      continue;
    }
    const second = await fetchWithRetry(waybackTarget);
    if (second.status === 'CAP_EXCEEDED') {
      log(`!! 50 MB cap exceeded — stopping.`);
      break;
    }
    if (second.ok) {
      await saveFile(c.dest, second.body);
      results.recovered_wayback.push({ ...r, waybackUrl: waybackTarget });
      vlog(`  ok via Wayback`);
    } else {
      results.still_broken.push({
        ...r,
        reason: `burgoblog ${first.status}; Wayback ${second.status}`,
      });
    }
  }

  /* ---------- Summary ---------- */

  log('---');
  log(`recovered from burgoblog.com  ${results.recovered_burgoblog.length}`);
  log(`recovered from Wayback         ${results.recovered_wayback.length}`);
  log(`skipped (widget, by design)    ${results.skipped_widget.length}`);
  log(`skipped (already on disk)      ${results.skipped_existing.length}`);
  log(`skipped (unknown ref shape)    ${results.skipped_unknown.length}`);
  log(`still broken                   ${results.still_broken.length}`);
  log(`total downloaded               ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

  if (DRY_RUN) {
    log('Dry run finished — no files written, MIGRATION_IMAGE_AUDIT.md unchanged.');
    return;
  }

  /* ---------- Rewrite MIGRATION_IMAGE_AUDIT.md ---------- */

  const auditText = await readFile(AUDIT, 'utf8');
  const block = [
    '',
    '## Recovery run',
    '',
    `Ran \`scripts/recover-images.mjs\` on ${new Date().toISOString().slice(0, 10)}.`,
    '',
    `- Recovered from burgoblog.com: **${results.recovered_burgoblog.length}**`,
    `- Recovered from Wayback Machine: **${results.recovered_wayback.length}**`,
    `- Stripped from source (widget gifs): **${results.skipped_widget.length}** (see widget-strip commit)`,
    `- Still broken: **${results.still_broken.length}**`,
    `- Bytes downloaded: ${(totalBytes / 1024 / 1024).toFixed(2)} MB / 50 MB cap`,
    '',
  ];
  if (results.still_broken.length > 0) {
    block.push('### Still broken');
    block.push('');
    for (const s of results.still_broken) {
      block.push(`- \`${s.src}\` (${s.post}) — ${s.reason}`);
    }
    block.push('');
  }
  if (results.recovered_wayback.length > 0) {
    block.push('### Wayback recoveries');
    block.push('');
    for (const s of results.recovered_wayback) {
      block.push(`- \`${s.src}\` ← ${s.waybackUrl}`);
    }
    block.push('');
  }
  const sentinel = '## Recovery run';
  const updated = auditText.includes(sentinel)
    ? auditText.replace(/\n## Recovery run[\s\S]*$/, '\n' + block.join('\n'))
    : auditText.trimEnd() + '\n' + block.join('\n');
  await writeFile(AUDIT, updated);
  log('Rewrote site/MIGRATION_IMAGE_AUDIT.md with recovery counts.');
}

main().catch((e) => {
  console.error('[recover-images] FATAL:', e);
  process.exit(1);
});
