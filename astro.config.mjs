// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import blogEditor from './integrations/blog-editor.mjs';
import rehypeImageWidth from './src/lib/rehype-image-width.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://bryan-dkl.github.io',
  base: process.env.NODE_ENV === 'production' ? '/BAP-Blog' : '/',
  // The editor (/editor/) saves to GitHub on the live site. This integration adds the
  // local version for `npm run dev`, which saves straight into the project folder instead.
  integrations: [blogEditor()],

  // ---------- Image optimisation ----------
  // All pictures (in posts, covers, team photos) are converted to WebP and resized at build time.
  // `constrained` = never wider than needed, with a srcset so each screen gets a fitting size.
  image: {
    layout: 'constrained',
    breakpoints: [480, 728, 1080, 1456], // 728px = width of the post column, 1456px = retina
  },
  // ---------- Fonts ----------
  // Downloaded at build time and served from our own site (no requests to Google from visitors).
  // Use it with <Font cssVariable="--font-display" /> in the page head and var(--font-display) in CSS.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Bagel Fat One',
      cssVariable: '--font-display',
      fallbacks: ['Arial Rounded MT Bold', 'system-ui', 'sans-serif'],
    },
  ],
  markdown: {
    // Caps pictures inside posts at the post column width (see the file for details).
    rehypePlugins: [[rehypeImageWidth, { maxWidth: 728 }]],
  },
});
