# Astro Starter Kit: Minimal

```sh
npm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

## Writing a blog post

The easiest way is the **editor**:

1. `npm run dev`
2. Open <http://localhost:4321/BAP-Blog/editor/> (or click **+ New post** in the menu)
3. Fill in title, date, pillars, type, cover picture and write the post.
   - **Pictures:** drag & drop, paste (screenshots!) or use the 🖼 Picture button. iPhone HEIC photos must be exported as JPG first.
   - **Videos / PDFs / other files:** 📎 Video / file button.
   - **YouTube, Vimeo, Figma:** ▶ Embed button.
4. Click **Publish** (or **Save as draft**: only visible in `npm run dev`).
5. To change a post: pick it in "Edit an existing post", or click **✎ Edit this post** on the post itself.

Then commit + push like usual and GitHub Actions deploys it.

Where things end up:

| what              | where |
|-------------------|-------|
| the post          | `src/content/blog/YYYY-MM-DD-title.md` |
| pictures + cover  | `src/assets/blog/<post-id>/` (Astro optimises them at build) |
| videos / files    | `public/media/<post-id>/` |

The editor only exists locally (it's a small dev-server add-on in `integrations/blog-editor.mjs`); the deployed site never contains it.
Other ways: `npm run new-post` in the terminal, or copy `src/content/blog/_template.md`.

Frontmatter fields:

| field         | required | values |
|---------------|----------|--------|
| `title`       | yes      | text |
| `date`        | yes      | `2026-10-30` |
| `pillars`     | yes      | one or more of `development`, `ux`, `design` |
| `types`       | no       | `experiment`, `research`, `feedback`, `meeting`, `milestone`, `reflection` |
| `description` | no       | shown on the overview |
| `cover`       | no       | `"../../assets/blog/<post-id>/cover.jpg"` |
| `coverAlt`    | no       | description of the cover picture |
| `authors`     | no       | list of names |
| `draft`       | no       | `true` = only visible in `npm run dev` |

Pillars and types are defined in `src/data/taxonomy.ts` — edit them there.

### Structure

```
src/
├─ content.config.ts        # schema for posts (title, date, pillars, types, ...)
├─ content/blog/            # the posts (.md)
├─ data/taxonomy.ts         # pillars + extra filters, labels and colours
├─ lib/posts.ts             # getPosts(), date formatting, group by month
├─ layouts/BaseLayout.astro # header, footer, <head>
├─ components/              # FilterBar, PostCard, Tags
├─ pages/index.astro        # chronological overview + filters
├─ pages/blog/[id].astro    # individual post (with previous/next)
├─ pages/editor.astro       # local editor (new + edit posts, pictures, files, embeds)
├─ assets/blog/<post-id>/   # pictures per post
└─ styles/                  # global.css + editor.css
integrations/blog-editor.mjs # dev-only API that saves posts + uploads
public/media/<post-id>/     # videos / files per post
scripts/new-post.mjs        # `npm run new-post`
```
