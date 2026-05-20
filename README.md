# Burgo's Music Blog

Static rebuild of [burgoblog.com](https://burgoblog.com) on Astro 4, replacing
the WordPress install that's been running since 2007. 399 posts, 5 pages,
555 comments across 155 posts, and 802 taxonomy entries — all preserved with
their original URLs.

## Running locally

```sh
cd site
npm install
npm run dev      # http://localhost:4321
```

The build is fully static:

```sh
cd site
npm run build    # outputs to site/dist/
npm run preview  # serves the built dist on http://localhost:4321
```

Requires Node 18+.

## Repo layout

```
/                         repo root
├─ site/                  Astro 4 project — everything that ships
│  ├─ src/
│  │  ├─ content/
│  │  │  ├─ posts/        399 .md files, one per post
│  │  │  ├─ pages/        5 static pages (about, contact, …)
│  │  │  └─ comments/     155 .json files, one per post that has comments
│  │  ├─ data/            tags.json + categories.json (built-time taxonomy)
│  │  ├─ pages/           routes
│  │  ├─ layouts/         Base, Post, Page, Archive
│  │  └─ components/      18 design-system components
│  ├─ public/
│  │  └─ wp-content/uploads/  All images from the legacy WP install (~296MB)
│  ├─ astro.config.mjs
│  └─ vercel.json         trailing-slash setting + 301 redirect map
├─ scripts/extract.mjs    Task 1 extractor (kept for reproducibility)
└─ README.md
```

## Adding a new post

1. Create `site/src/content/posts/YYYY-MM-DD-slug.md` with the filename
   matching the URL date and slug.
2. Front matter:

   ```yaml
   ---
   title: "Post title with smart quotes if you want"
   slug: slug
   date: YYYY-MM-DD
   author: Burgo
   categories: [music]
   tags: [some, comma, separated, tag, slugs]
   featured_image: /wp-content/uploads/your-image.jpg   # or null
   comment_count: 0
   permalink: /YYYY/MM/DD/slug/
   ---
   ```

   Quote the title if it contains a colon. `tags` and `categories` must
   all be strings — quote any all-digit slugs like `"2005"`.
3. Drop the body underneath as Markdown. Inline `<iframe>` / `<img>` HTML
   is allowed; Astro doesn't sanitize Markdown by default.
4. If the post adds to a new tag or category, update
   `site/src/data/tags.json` or `categories.json` with `{slug, name, post_count}`.
5. Build to verify: `cd site && npm run build`.

## How the migration was performed

Three discrete tasks landed on `main` in sequence, each as a reviewable PR:

- **Task 1** — `scripts/extract.mjs` walked `post-sitemap.xml` and converted
  the WordPress static mirror to Markdown + JSON. Output went into
  `content/`. See `site/EXTRACTION_REPORT.md` for the audit (399 posts,
  555 comments, 73 dropped Flash embeds).
- **Task 2** — `site/` was bootstrapped from the Claude Design bundle:
  Astro 4.16, Tailwind, the design system (album-sleeve / typewriter
  aesthetic), routes for posts, archives, tag and category indexes,
  pagination, RSS, 404, and three placeholder posts.
- **Task 3** — this branch. Migrated the Task 1 output into Task 2's
  Astro project, fixed frontmatter that didn't pass the Zod schema,
  cleaned up the legacy WP mirror at the repo root, wired the
  `@astrojs/sitemap` integration, added a vercel.json redirect map for
  URLs that didn't survive Task 1's slug normalization, and added a
  client-side search box to the 404 page.

## Redirect strategy

`site/vercel.json` does two things:

1. Maps `/feed`, `/comments/feed`, `/rss`, and the WP-era `feed/{rss,rss2,atom}/`
   variants to `/rss.xml` so existing subscribers don't break.
2. 301-redirects four specific legacy URLs whose original WordPress slug
   contained multibyte unicode (`…`, `'`, `'`). Task 1's extractor
   resolved the post directory by stripping those characters, so the
   migrated post slug is ASCII. The redirect maps the percent-encoded
   original URL to the destination Astro actually built.

Every URL in the original `post-sitemap.xml` either resolves to a built
HTML file directly (395 of 399) or is captured by one of those four
redirects.

## Deployment

The project deploys statically to Vercel — `npm run build` is the only
build step, and `site/dist/` is the output directory. `site/vercel.json`
is read by Vercel automatically.

There is no Lighthouse check in CI: the cloud session that ran the
migration has no Chromium installed, and the repo is too small to
warrant adding a managed runner. Run Lighthouse locally on
`http://localhost:4321` after `npm run preview` if you need a score.
