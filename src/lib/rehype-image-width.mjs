// Gives every local picture in a Markdown post a maximum width.
//
// Astro already converts post pictures to WebP at build time, but without a width it keeps
// them at their original size (a 3000px screenshot stays 3000px). With a width set, Astro
// resizes them and — together with `image.layout: 'constrained'` in astro.config.mjs —
// creates a srcset (e.g. 480 / 728 / 1080 / 1456px), so phones download a small version
// and retina screens a sharp one, but nobody downloads the original.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export default function rehypeImageWidth({ maxWidth = 728 } = {}) {
  let sharpPromise;
  const loadSharp = () =>
    (sharpPromise ??= import('sharp').then((m) => m.default).catch(() => null)); // installed with Astro

  return async (tree, file) => {
    const images = [];
    (function walk(node) {
      if (node.type === 'element' && node.tagName === 'img') images.push(node);
      node.children?.forEach(walk);
    })(tree);
    if (images.length === 0) return;

    const filePath = typeof file.path === 'string' ? file.path : file.path ? fileURLToPath(file.path) : null;

    await Promise.all(
      images.map(async (node) => {
        const src = node.properties?.src;
        // Only local pictures; leave remote URLs, absolute paths, SVGs and images that already have a width alone.
        if (typeof src !== 'string' || /^([a-z]+:|\/)/i.test(src) || /\.svg$/i.test(src) || node.properties.width) return;

        let width = maxWidth;
        const sharp = await loadSharp();
        if (sharp && filePath) {
          try {
            const meta = await sharp(resolve(dirname(filePath), decodeURI(src))).metadata();
            if (meta.width) width = Math.min(maxWidth, meta.width); // never upscale small pictures
          } catch {
            // unreadable file: Astro will report it itself
          }
        }
        node.properties.width = width;
      }),
    );
  };
}
