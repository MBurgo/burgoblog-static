import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';

// Trailing slash matches the WordPress permalink format (/2024/02/14/slug/).
// Required for URL preservation — see Task 2 brief.
export default defineConfig({
  site: 'https://burgoblog.com',
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  integrations: [tailwind({ applyBaseStyles: false }), mdx()],
});
