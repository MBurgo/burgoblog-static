import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import tagsRaw from '@/data/tags.json';
import categoriesRaw from '@/data/categories.json';

export type Tag = { slug: string; name: string; post_count: number };
export type Category = Tag;

export const tags = tagsRaw as Tag[];
export const categories = categoriesRaw as Category[];

export type PostEntry = CollectionEntry<'posts'>;

export async function getSortedPosts(): Promise<PostEntry[]> {
  const posts = await getCollection('posts');
  return posts.sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );
}

export function totalPostCount(posts: PostEntry[]): number {
  return posts.length;
}

export function topTags(limit: number): Tag[] {
  return [...tags]
    .sort((a, b) => b.post_count - a.post_count)
    .slice(0, limit);
}

export function topCategories(limit: number): Category[] {
  return [...categories]
    .sort((a, b) => b.post_count - a.post_count)
    .slice(0, limit);
}

export type YearGroup = {
  year: number;
  count: number;
  top: { title: string; permalink: string }[];
};

// Group posts by year, then for each year surface the three posts with the
// highest comment_count as the "top" highlights for the Vault popover.
export function postsByYear(posts: PostEntry[]): YearGroup[] {
  const byYear = new Map<number, PostEntry[]>();
  for (const post of posts) {
    const year = post.data.date.getFullYear();
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(post);
  }
  return Array.from(byYear.entries())
    .map(([year, entries]) => {
      const top = [...entries]
        .sort((a, b) => b.data.comment_count - a.data.comment_count)
        .slice(0, 3)
        .map((e) => ({ title: e.data.title, permalink: e.data.permalink }));
      return { year, count: entries.length, top };
    })
    .sort((a, b) => a.year - b.year);
}

export type Tone = 'rust' | 'cream' | 'ink' | 'mustard' | 'olive';
const TONE_CYCLE: Tone[] = ['rust', 'cream', 'ink', 'mustard', 'olive'];

// Stable per-post sleeve colour so re-renders don't shuffle the homepage.
export function toneForPost(post: PostEntry): Tone {
  if (post.data.sleeveTone) return post.data.sleeveTone;
  const key = post.data.slug;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return TONE_CYCLE[hash % TONE_CYCLE.length];
}

// Derive a short "dek" (homepage excerpt) — frontmatter takes precedence,
// otherwise strip markdown from the first paragraph of the body.
export function dekFor(post: PostEntry, max = 220): string {
  if (post.data.dek) return post.data.dek;
  const body = post.body ?? '';
  const firstPara = body.split(/\n{2,}/).find((p) => p.trim().length > 0) ?? '';
  const plain = firstPara
    .replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? plain.slice(0, max - 1).trimEnd() + '…' : plain;
}

export function formatPermalink(post: PostEntry): string {
  return post.data.permalink;
}

// Date helpers — the design uses MONO labels like "FEB · 14 · 2024".
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function formatStampDate(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatMetaDate(date: Date): string {
  return `${MONTHS[date.getMonth()]} · ${String(date.getDate()).padStart(2, '0')} · ${date.getFullYear()}`;
}

export function readMinutes(post: PostEntry): number {
  const words = (post.body ?? '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
