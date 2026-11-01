import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { pillarKeys, postTypeKeys } from './data/taxonomy';

// Every .md / .mdx file in src/content/blog is a post.
// Files starting with an underscore (e.g. _template.md) are ignored.
// Pictures for a post live in src/assets/blog/<post-id>/ (the editor puts them there).
const blog = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      description: z.string().optional(),
      // Optional cover picture, e.g. "../../assets/blog/<post-id>/cover.jpg"
      cover: image().optional(),
      coverAlt: z.string().optional(),
      // At least one pillar; a post can cover several.
      pillars: z.array(z.enum(pillarKeys)).min(1),
      // Extra filters: experiment, feedback, meeting, ...
      types: z.array(z.enum(postTypeKeys)).default([]),
      authors: z.array(z.string()).default([]),
      // Drafts show up in `npm run dev` but not in the built site.
      draft: z.boolean().default(false),
    }),
});

export const collections = { blog };
