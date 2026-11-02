// @ts-check
import { defineConfig } from 'astro/config';
import blogEditor from './integrations/blog-editor.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://bryan-dkl.github.io',
  base: process.env.NODE_ENV === 'production' ? '/BAP-Blog' : '/',
  // The editor (/editor/) saves to GitHub on the live site. This integration adds the
  // local version for `npm run dev`, which saves straight into the project folder instead.
  integrations: [blogEditor()],
});
