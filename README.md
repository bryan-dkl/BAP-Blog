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

### On the live site (recommended)

1. Go to <https://bryan-dkl.github.io/BAP-Blog/editor/> (or click **+ New post**).
2. The first time, connect with your own GitHub token (the page explains how to make one):
   - repo owner → fine-grained token, only the `BAP-Blog` repo, *Contents: Read and write*
   - collaborators → classic token with the `public_repo` scope
   The token is stored only in your browser.
3. Write the post, add pictures (drag & drop / paste / 🖼), videos or files (📎) and embeds (▶ YouTube, Vimeo, Figma).
4. **Publish** → the editor makes one commit on `main` with the post and its files.
   That triggers the *Deploy to GitHub Pages* workflow; the post is online after ~1–2 minutes.
5. To change a post: **✎ Edit this post** on the post, or pick it in "Edit an existing post".

⚠️ Because the editor pushes to GitHub, run `git pull` before you work locally again.

### Locally

`npm run dev` → <http://localhost:4321/editor/>. Same editor, but saving writes straight into your project folder
(commit & push yourself). Add `?mode=github` to the URL to test the GitHub flow locally.

Other ways: `npm run new-post` in the terminal, or copy `src/content/blog/_template.md`.

Where things end up:

| what              | where |
|-------------------|-------|
| the post          | `src/content/blog/YYYY-MM-DD-title.md` |
| pictures + cover  | `src/assets/blog/<post-id>/` (Astro optimises them at build) |
| videos / files    | `public/media/<post-id>/` (max ~90 MB — put big videos on YouTube and embed them) |

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
├─ pages/editor.astro       # the editor page (new + edit posts, pictures, files, embeds)
├─ lib/editor/              # editor logic: GitHub + local saving, frontmatter helpers
├─ data/github.ts           # which repo/branch the editor commits to
├─ assets/blog/<post-id>/   # pictures per post
└─ styles/                  # global.css + editor.css
integrations/blog-editor.mjs # local save API for `npm run dev`
public/media/<post-id>/     # videos / files per post
scripts/new-post.mjs        # `npm run new-post`
```
