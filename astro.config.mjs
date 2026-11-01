// @ts-check
import { defineConfig } from 'astro/config';
import blogEditor from './integrations/blog-editor.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://bryan-dkl.github.io',
  base: process.env.NODE_ENV === 'production' ? '/BAP-Blog' : '/',
  // Local post editor at /editor/ — only active during `npm run dev`, not part of the deployed site.
  integrations: [blogEditor()],
});
