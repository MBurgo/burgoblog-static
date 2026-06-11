// Build-time search index used by the site-wide search overlay and the
// 404 page's client-side filter. Pulled fresh from the posts collection
// on every build. `text` is the post body stripped to lowercase plain
// text so searches match artist/album mentions inside posts (e.g. a
// roundup post that names dozens of artists), not just titles.
import { getSortedPosts } from '@/lib/data';

function stripToPlainText(body) {
  return body
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[*_`>#\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export async function GET() {
  const posts = await getSortedPosts();
  const index = posts.map((post) => ({
    title: post.data.title,
    permalink: post.data.permalink,
    year: post.data.date.getFullYear(),
    text: stripToPlainText(post.body ?? ''),
  }));
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' },
  });
}
