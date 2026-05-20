# Image audit

Thorough audit of image references across all 399 migrated posts. Generated
post-build from `site/src/content/posts/` against the moved
`site/public/wp-content/` tree.

This audit supersedes the spot-check in PR #3 — that one only recognised
`/wp-content/uploads/...` references and missed three other reference shapes
that account for the great majority of the actual broken-image surface.

## Totals

- **Total image references scanned:** 732
- **Broken (referenced file not present in `site/public/wp-content/`):** 87
- **Posts with at least one broken image:** 27 out of 399 (6.8%)

Audio references (`.mp3` etc.) are tracked separately and not included in the
broken-image total. None were detected in image-syntax — only in regular
Markdown links — so they're outside this audit's scope.

These images render fine on the live `burgoblog.com` WordPress install. The
static mirror that Task 1 extracted from didn't include the files, so the
references point to paths that don't exist under
`site/public/wp-content/`. They were broken when we cloned the repo, not
introduced by the migration. Remediation strategy is a separate decision.

## Reference-format distribution

| Count | Format |
| ---: | --- |
| 651 | `/wp-content/uploads/...` (current canonical) |
|  70 | `/wp-content/<file>` (no `uploads/` segment) |
|  11 | other absolute paths (`/files/...`, third-party widget paths) |

## Broken by year

| Year | Broken | Total refs | Rate |
| ---: | ---: | ---: | ---: |
| 2007 | 53 | 54  | 98.1% |
| 2008 | 28 | 303 |  9.2% |
| 2009 |  2 | 51  |  3.9% |
| 2010 |  0 | 107 |  0.0% |
| 2011 |  2 | 119 |  1.7% |
| 2012 |  2 | 27  |  7.4% |
| 2013 |  0 | 14  |  0.0% |
| 2014 |  0 | 2   |  0.0% |
| 2017 |  0 | 16  |  0.0% |
| 2022 |  0 | 22  |  0.0% |
| 2024 |  0 | 17  |  0.0% |

2007 is the standout — almost every image in the year is broken, because
that's when burgoblog was still on burgoblog.wordpress.com and referenced
`/files/...` paths, and when the post body used `/wp-content/<file>` instead
of `/wp-content/uploads/<file>`.

## What the original audit missed

The Task 3 step-7 spot-check only recognised image references that started
with `/wp-content/uploads/`. The thorough re-audit picks up three additional
reference shapes that were silently ignored before:

1. **`/wp-content/<file>`** — no `uploads/` segment. Most common in posts
   from 2007–2008. The 30-South-African-bands post is the headline example:
   every artist photo is at `/wp-content/big-idea.jpg`,
   `/wp-content/guy-buttery.jpg`, etc., not `/wp-content/uploads/...`. 70
   refs across the corpus, none present in the static mirror.
2. **`/files/YYYY/MM/<file>`** — the original burgoblog.wordpress.com
   hosted-era URL prefix, before the move to a self-hosted WordPress in
   2008. Eight such refs in 2007 posts.
3. **Stray absolute paths** — `/en_AU/i/scr/pixel.gif`,
   `/public/resources/img/embed/make-a-mixtape.gif`, `/7xjnjh3.jpg`. Almost
   certainly copied verbatim from third-party widgets (eBay, mixtape.me,
   image hosts) at posting time and broken on burgoblog.com too.

The migration didn't change any image URL — every one of these is the
literal string from the WordPress post body. The original audit's
spot-check missed them because they don't match `/wp-content/uploads/`,
and the 20-random-post sample happened to land on posts where all images
did use the canonical path. The 30-South-African-bands post would have
flagged immediately had it been in the sample.

## Posts with broken images

Each entry lists the post and every broken image reference under it.

### `2007-09-21-finetune-my-new-friend.md`
- `/files/2007/11/finetunecom.jpg` (md)

### `2007-10-10-in-rainbows-arrived.md`
- `/files/2007/10/radiohead.jpg` (md)

### `2007-10-26-rip-lucky-dube.md`
- `/files/2007/10/lucky_dube_500.jpg` (md)

### `2007-11-06-projectplaylistcom.md`
- `/files/2007/11/project-playlist.jpg` (md)

### `2007-11-13-gibsons-robot-guitar.md`
- `/files/2007/11/gibson-robot-guitar_1.jpg` (md)
- `/files/2007/11/gibson-robot-guitar2.jpg` (md)

### `2007-11-19-state-radio-come-to-australia.md`
- `/files/2007/11/sr_press_pic_2edit.jpg` (md)

### `2007-11-23-brett-dennen-aint-no-reason.md`
- `/files/2007/11/dennen.jpg` (md)

### `2007-12-02-those-poor-ripped-off-artists.md`
- `/wp-content/axl-roses-5.jpg` (md)

### `2007-12-07-30-south-african-bands-you-need-to-hear.md`
- `/wp-content/30.jpg` (md)
- `/wp-content/big-idea.jpg` (md)
- `/wp-content/guy-buttery.jpg` (md)
- `/wp-content/wonderboom.jpg` (md)
- `/wp-content/nibs.jpg` (md)
- `/wp-content/freshlyground.jpg` (md)
- `/wp-content/cynosure.jpg` (md)
- `/wp-content/farryl.jpg` (md)
- `/wp-content/the-parlotones.jpg` (md)
- `/wp-content/syd.jpg` (md)
- `/wp-content/justjinjer.jpg` (md)
- `/wp-content/springbok-nude-girls.jpg` (md)
- `/wp-content/lucky_dube_500.jpg` (md)
- `/wp-content/prime-circle.jpg` (md)
- `/wp-content/mr-smug.jpg` (md)
- `/wp-content/squeal.jpg` (md)
- `/wp-content/vusi.jpg` (md)
- `/wp-content/henry-ate.jpg` (md)
- `/wp-content/perez.jpg` (md)
- `/wp-content/arno-carstens.jpg` (md)
- `/wp-content/shaunjohndale2007ns5.jpg` (md)
- `/wp-content/deluxe.jpg` (md)
- `/wp-content/sitter.jpg` (md)
- `/wp-content/movie55.jpg` (md)
- `/wp-content/boon.jpg` (md)
- `/wp-content/tree63.jpg` (md)
- `/wp-content/max-normal.jpg` (md)
- `/wp-content/tweak.JPG` (md)
- `/wp-content/plush.jpg` (md)
- `/wp-content/rory-eliot.jpg` (md)

### `2007-12-10-who-are-the-foxboro-hot-tubs-you-decide.md`
- `/wp-content/foxborohottubs1.jpg` (md)

### `2007-12-11-jeremy-fisher-goodbye-blue-monday.md`
- `/wp-content/jeremy-fisher.jpg` (md)

### `2007-12-13-its-a-coldplay-christmas-2000-miles-and-a-side-order-of-the-pogues.md`
- `/wp-content/coldplay-christmas-msg.jpg` (md)
- `/wp-content/pogues.jpg` (md)

### `2007-12-13-terry-pratchett-has-been-diagnosed-with-early-onset-alzheimers-buggrit.md`
- `/wp-content/terry-pratchett.jpg` (md)

### `2007-12-16-crosby-stills-nash-about-time-for-brisbane.md`
- `/wp-content/crosby-stills.jpg` (md)

### `2007-12-19-jack-johnsons-new-album-and-another-christmas-cover.md`
- `/wp-content/jack-johnson.jpg` (md)

### `2007-12-20-stereophonics-best-of-you-cover.md`
- `/wp-content/stereophonics-live-on-the-live-lounge-tour.jpg` (md)

### `2007-12-23-state-radio-roger-that-the-beautiful-girls-at-the-tivoli.md`
- `/wp-content/roger-that2.jpg` (md)
- `/wp-content/state-radio.jpg` (md)
- `/wp-content/thebeautifulgirls2.jpg` (md)

### `2007-12-23-the-wombats-lets-dance-to-joy-division.md`
- `/wp-content/desperation.jpg` (md)

### `2007-12-28-the-sounds-of-london-jack-penate-and-jamie-t.md`
- `/wp-content/jack-penate.jpg` (md)
- `/wp-content/jamie_t.jpg` (md)

### `2008-01-03-things-i-probably-should-have-told-you-in-2007.md`
- `/wp-content/glen-hansard2.jpg` (md)
- `/wp-content/basia-bulat2.jpg` (md)
- `/wp-content/band-of-horses.jpg` (md)
- `/wp-content/andrew-bird-armchair.jpg` (md)
- `/wp-content/lightning-dust2.jpg` (md)
- `/wp-content/patrick-park.jpg` (md)
- `/wp-content/great-lake-swimmers-2.jpg` (md)
- `/wp-content/bon-iver3.jpg` (md)
- `/wp-content/roguewave2.jpg` (md)
- `/wp-content/arcadefire_hi.jpg` (md)
- `/wp-content/weakerthans.jpg` (md)
- `/wp-content/hard-fi2.jpg` (md)
- `/wp-content/wilco.jpg` (md)
- `/wp-content/low2.jpg` (md)
- `/wp-content/iron-and-wine2.jpg` (md)
- `/wp-content/againstme.jpg` (md)
- `/wp-content/portugal-the-man.jpg` (md)
- `/wp-content/stephenmalkmusandthejicks2.jpg` (md)
- `/wp-content/georgestanford2.jpg` (md)
- `/wp-content/alternateroutes.jpg` (md)
- `/wp-content/national_boxer.jpg` (md)
- `/wp-content/cowboy.jpg` (md)
- `/wp-content/joshritter.jpg` (md)
- `/wp-content/bright-eyes.jpg` (md)

### `2008-01-07-u2-in-a-little-while-for-joey-ramone.md`
- `/wp-content/u2-in-a-little-while.jpg` (md)

### `2008-05-08-live-music-friday-ryan-adams-the-cardinals-live-on-nprs-world-cafe.md`
- `/en_AU/i/scr/pixel.gif` (md)

### `2008-06-05-burgos-blog-a-retrospective-mixtape.md`
- `/public/resources/img/embed/make-a-mixtape.gif` (md)

### `2008-11-14-william-fitzsimmons-the-sparrow-the-crow.md`
- `/7xjnjh3.jpg` (md)

### `2009-02-02-new-damnwells-record-one-last-century.md`
- `/wp-content/uploads/2009/01/centurycoversmall1.jpg` (featured_image)
- `/wp-content/uploads/2009/01/centurycoversmall1.jpg` (md)

### `2011-08-01-new-frightened-rabbit-fuck-this-place-stream.md`
- `/wp-content/uploads/Frightened-Rabbit.jpg` (featured_image)
- `/wp-content/uploads/Frightened-Rabbit.jpg` (md)

### `2012-02-15-pete-yorn-surfer-girl-cover.md`
- `/wp-content/uploads/Pete-Yorn.jpg` (featured_image)
- `/wp-content/uploads/Pete-Yorn.jpg` (md)
