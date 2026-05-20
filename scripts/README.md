# scripts/

One-off tooling for the migration. Not part of the Astro build.

| Script | Purpose | Status |
| --- | --- | --- |
| `extract.mjs` | Task 1: walk the WordPress static mirror and write `content/`. | Used once; preserved for reproducibility. |
| `recover-images.mjs` | Fetch images that the WP mirror was missing (87 refs across 27 posts, per `site/MIGRATION_IMAGE_AUDIT.md`). | Run on demand. |
| `backfill-30-bands-comments.mjs` | Fetch the older-page WordPress comments on the 30-South-African-bands post (1 of 399 posts has paginated comments). | Run on demand. |

## Running

All scripts assume Node 18+. From the repo root:

```sh
# Make sure cheerio + turndown are installed (used by extract.mjs and
# backfill-30-bands-comments.mjs). recover-images.mjs uses stdlib only.
npm install

# Image recovery — fetches from burgoblog.com with Wayback fallback for
# /files/* refs, saves under site/public/wp-content/ and site/public/files/.
node scripts/recover-images.mjs --dry-run        # preview
node scripts/recover-images.mjs                  # for real
node scripts/recover-images.mjs --verbose        # progress per ref

# 30-bands comment backfill — merges WordPress's /comment-page-1/ into the
# existing comments JSON, deduped by (author, date).
node scripts/backfill-30-bands-comments.mjs --dry-run
node scripts/backfill-30-bands-comments.mjs
```

Each script has a longer docstring at the top of the file (deps, exact
flags, output paths, how to verify the run worked).

## Notes

- `recover-images.mjs` is capped at 50 MB of total downloads. It rate-limits
  to one request per second and backs off exponentially on 429/5xx.
- `recover-images.mjs` updates `site/MIGRATION_IMAGE_AUDIT.md` in place
  with a "Recovery run" block at the bottom listing what was recovered
  from where and what remains broken.
- `backfill-30-bands-comments.mjs` overwrites the JSON for that one post,
  oldest-first to match Task 1's ordering.
- Both scripts have `--dry-run` modes that hit the network for preview
  but don't write anything.
