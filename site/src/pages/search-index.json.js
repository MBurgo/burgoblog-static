// Build-time search index: lightweight title+permalink list used by the
// 404 page's client-side filter. Pulled fresh from the posts collection on
// every build.
import { getSortedPosts } from '@/lib/data';

export async function GET() {
  const posts = await getSortedPosts();
  const index = posts.map((post) => ({
    title: post.data.title,
    permalink: post.data.permalink,
    year: post.data.date.getFullYear(),
  }));
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' },
  });
}
