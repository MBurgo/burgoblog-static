import rss from '@astrojs/rss';
import { getSortedPosts, dekFor } from '@/lib/data';

// 20 most recent posts, matching the legacy WP feed's default page size so
// existing subscribers see continuity.
const FEED_ITEMS = 20;

export async function GET(context) {
  const posts = (await getSortedPosts()).slice(0, FEED_ITEMS);
  return rss({
    title: "Burgo's Music Blog",
    description: "Matt Burgess's music blog — running since 2007, posting from Brisbane.",
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: dekFor(post, 320),
      link: post.data.permalink,
      categories: [...post.data.categories, ...post.data.tags],
    })),
    customData: '<language>en-au</language>',
  });
}
