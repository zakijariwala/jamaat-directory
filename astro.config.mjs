import { defineConfig } from 'astro/config';

// Static output — deployed to Cloudflare Pages. The /api/* routes and
// /directory.json are served by Cloudflare Pages Functions (see functions/),
// which run on the same origin as this static site. No SSR adapter needed.
export default defineConfig({
  output: 'static',
  // site: set to the production URL before deploy (used for canonical + sitemap).
  build: {
    // Inline small stylesheets/scripts to cut request count on 3G.
    inlineStylesheets: 'auto',
  },
});
