import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// Trailing slash matches the WordPress permalink format (/2024/02/14/slug/).
// Required for URL preservation — see Task 2 brief.
export default defineConfig({
  site: 'https://burgoblog-static.vercel.app',
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  integrations: [
    tailwind({ applyBaseStyles: false }),
    mdx(),
    sitemap(),
  ],
});
