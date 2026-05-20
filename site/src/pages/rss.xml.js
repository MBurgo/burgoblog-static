import rss from '@astrojs/rss';
import { getSortedPosts, dekFor } from '@/lib/data';

export async function GET(context) {
  const posts = await getSortedPosts();
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
